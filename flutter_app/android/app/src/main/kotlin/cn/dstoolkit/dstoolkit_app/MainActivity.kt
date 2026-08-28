package cn.dstoolkit.dstoolkit_app

import android.os.Bundle
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.bytedance.sdk.openadsdk.AdSlot
import com.bytedance.sdk.openadsdk.TTAdConfig
import com.bytedance.sdk.openadsdk.TTAdLoadType
import com.bytedance.sdk.openadsdk.TTAdNative
import com.bytedance.sdk.openadsdk.TTAdSdk
import com.bytedance.sdk.openadsdk.TTRewardVideoAd

class MainActivity : FlutterActivity() {

    companion object {
        private const val TAG = "DstoolkitAds"
        private const val CHANNEL = "dstoolkit/ads"
        // 穿山甲（CSJ）激励视频配置（可在管理后台调整代码位 / AppId）
        private const val CSJ_APP_ID = "5873937"
        private const val CSJ_CODE_ID = "104441730"
    }

    private var sdkInited = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "showRewardVideo" -> {
                        val userId = call.argument<String>("userId") ?: ""
                        showRewardVideo(userId, result)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    /** 确保穿山甲 SDK 已初始化并启动完毕，再执行 onReady。 */
    private fun ensureSdkReady(onReady: () -> Unit, onError: (String) -> Unit) {
        if (sdkInited && TTAdSdk.isSdkReady()) {
            onReady()
            return
        }
        try {
            TTAdSdk.init(
                applicationContext,
                TTAdConfig.Builder()
                    .appId(CSJ_APP_ID)
                    .appName("DSToolKit")
                    .debug(false)
                    // 代码位 104441730 是竞价/GroMore 类型，必须打开 useMediation，否则 onError code=40006
                    .useMediation(true)
                    .build()
            )
        } catch (e: Exception) {
            Log.e(TAG, "TTAdSdk.init 异常", e)
        }
        TTAdSdk.start(object : TTAdSdk.Callback {
            override fun success() {
                sdkInited = true
                Log.i(TAG, "TTAdSdk 启动成功")
                onReady()
            }

            override fun fail(code: Int, msg: String?) {
                sdkInited = false
                Log.e(TAG, "TTAdSdk 启动失败: code=$code msg=$msg")
                onError("广告 SDK 启动失败($code)")
            }
        })
    }

    private fun showRewardVideo(userId: String, result: MethodChannel.Result) {
        ensureSdkReady(
            onReady = {
                val adManager = TTAdSdk.getAdManager()
                if (adManager == null) {
                    runOnUiThread { result.error("SDK_NULL", "广告管理器为空", null) }
                    return@ensureSdkReady
                }
                val adNative = adManager.createAdNative(applicationContext)
                // 每次请求前重置标志，防止上一轮残留
                adHandled = false
                val adSlot = AdSlot.Builder()
                    .setCodeId(CSJ_CODE_ID)
                    .setAdLoadType(TTAdLoadType.LOAD)
                    .setRewardAmount(1)
                    .setRewardName("会员权益")
                    .setUserID(userId) // S2S 服务端回调 user_id
                    .build()

                adNative.loadRewardVideoAd(adSlot, object : TTAdNative.RewardVideoAdListener {
                    override fun onError(code: Int, message: String?) {
                        runOnUiThread {
                            result.error("LOAD_FAILED", "广告加载失败: $code ${message ?: ""}", null)
                        }
                    }

                    override fun onRewardVideoAdLoad(ad: TTRewardVideoAd?) {
                        // 广告基础信息就绪，可直接展示
                        ad?.let { setupAndShow(it, result) }
                    }

                    override fun onRewardVideoCached() {
                        // 已废弃，空实现即可
                    }

                    override fun onRewardVideoCached(ad: TTRewardVideoAd?) {
                        // 素材缓存完成，展示更流畅
                        ad?.let { setupAndShow(it, result) }
                    }
                })
            },
            onError = { msg -> runOnUiThread { result.error("SDK_NOT_READY", msg, null) } }
        )
    }

    /**
     * 给广告对象挂上生命周期监听并展示。
     * 用 adHandled 防止 onRewardVideoAdLoad 与 onRewardVideoCached 重复触发。
     */
    private var adHandled = false
    private var rewardEarned = false
    private var resultResolved = false

    private fun setupAndShow(ad: TTRewardVideoAd, result: MethodChannel.Result) {
        if (adHandled) return
        adHandled = true
        rewardEarned = false
        resultResolved = false

        ad.setRewardAdInteractionListener(object : TTRewardVideoAd.RewardAdInteractionListener {
            override fun onAdShow() {
                Log.d(TAG, "激励视频展示")
            }

            override fun onAdVideoBarClick() {}

            override fun onAdClose() {
                Log.d(TAG, "激励视频关闭 rewardEarned=$rewardEarned")
                if (resultResolved) return
                resultResolved = true
                val code = if (rewardEarned) "success" else "skipped"
                runOnUiThread {
                    result.success(
                        mapOf(
                            "code" to code,
                            "rewarded" to rewardEarned,
                            "appId" to CSJ_APP_ID,
                            "codeId" to CSJ_CODE_ID
                        )
                    )
                }
            }

            override fun onVideoComplete() {
                Log.d(TAG, "视频播放完成")
            }

            override fun onVideoError() {
                Log.e(TAG, "视频播放错误")
                if (resultResolved) return
                resultResolved = true
                runOnUiThread {
                    result.error("VIDEO_ERROR", "广告播放出错", null)
                }
            }

            override fun onRewardVerify(
                rewardVerify: Boolean,
                rewardAmount: Int,
                rewardName: String?,
                errorCode: Int,
                errorMsg: String?
            ) {
                // 已废弃，空实现
            }

            override fun onRewardArrived(isRewardValid: Boolean, rewardType: Int, extraInfo: Bundle?) {
                Log.i(TAG, "奖励到达 valid=$isRewardValid type=$rewardType")
                if (isRewardValid) rewardEarned = true
            }

            override fun onSkippedVideo() {
                Log.d(TAG, "用户跳过视频")
                rewardEarned = false
            }
        })

        ad.showRewardVideoAd(this)
    }
}
