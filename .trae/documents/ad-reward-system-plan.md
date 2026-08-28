# 广告投放体系（穿山甲激励视频 + 服务端回调领权益）实施计划

## Summary（摘要）

为 Flutter App 接入**穿山甲（CSJ/ByteDance）** 激励视频 SDK，建立「看广告领会员」体系：
- 每日看满 5 次激励视频 → 当日获 **PRO** 权益（当日有效，次日失效）。
- 连续达标（每日 5 次）≥3 天 → 当日权益升级为 **PLUS**；中断一天连击清零、次日回退 PRO，需重新连 3 天。
- 权益发放以**穿山甲服务端 → 我方后端 webhook** 为唯一可信源（防刷），客户端仅负责展示广告并轮询状态。
- 权益作为「日 boosts」叠加在用户已有付费等级之上：`effective = max(付费等级, 广告boost)`，**绝不降级**付费等级。

SDK：`穿山甲Android_sdk_7.7.1.6_双架构`（已确认，非项目里旧的 GDT SDK）。AppID `5873937`，激励视频代码位 `104441730`。webhook 路径 `https://api.dstoolkit.cn/webhoook/verify`（注意：用户在穿山甲后台已配置此 **`webhoook` 三连o 拼写**，按原样开发，勿改）。

---

## Current State Analysis（现状分析）

### 后端（backend/）
- **入口** [src/index.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/index.ts)：所有业务路由挂载在 `/api/...` 下；无根路径路由。需新增**根路径** `/webhoook/verify`（穿山甲回调 URL 不含 `/api`）。
- **会员体系** [src/services/subscription.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/services/subscription.ts)：`resolveEffectiveTier()` 处理年费到期降级；`activateTierWithCard()` 卡密升级。`Tier` 枚举 FREE/PRO/PLUS/ULTIMATE/TEAM。
- **配额** [src/utils/quota.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/utils/quota.ts)：`TIER_RANK` 等级权重、`TIER_LIMITS`、`checkUploadQuota`（内部调 resolveEffectiveTier）。
- **/me** [src/routes/v1.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/v1.routes.ts#L24-L31)：返回 `tier/tierExpiresAt/isPermanentTier`（付费等级字段）。App 的 `User` 模型据此显示等级徽章。
- **/subscription/status** [src/routes/subscription.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/subscription.routes.ts#L14-L43)：会员状态 + 用量 + 配额。
- **env** [src/config/env.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/config/env.ts)：已有 `required()/env` 模式；支付/kufaka 均走 env 开关。新增 `CSJ_REWARD_SECURITY_KEY` 遵循同模式。
- **Prisma schema** [prisma/schema.prisma](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/prisma/schema.prisma#L47-L91)：`User` 含 tier 字段；无广告相关表。

### Flutter App（flutter_app/）
- **认证/状态** [lib/features/auth/auth_controller.dart](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/lib/features/auth/auth_controller.dart)：Riverpod `StateNotifierProvider`；`AuthStatus` 含 `guest`；`User` 经 `/v1/me` 加载。
- **API 客户端** [lib/data/api/v1_api.dart](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/lib/data/api/v1_api.dart)：`V1Api` 封装 `/api/v1/*`；Dio 拦截器自动注入 `dstk_` token。
- **常量** [lib/core/constants/api_constants.dart](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/lib/core/constants/api_constants.dart)：集中 API/Web 配置。
- **路由** [lib/core/router/app_router.dart](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/lib/core/router/app_router.dart)：go_router，按 AuthStatus 重定向。
- **个人页** [lib/features/profile/profile_page.dart](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/lib/features/profile/profile_page.dart)：Neu-morphism 列表；`_TierBadge` 显示等级；已有"升级订阅"入口（跳 Web）。**广告入口将加在此页**。
- **Android 构建** [android/app/build.gradle.kts](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/build.gradle.kts)：`applicationId=cn.dstoolkit.dstoolkit_app`，Java/Kotlin 17，无额外 AAR 依赖声明。
- **Android Manifest** [android/app/src/main/AndroidManifest.xml](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/src/main/AndroidManifest.xml)：仅 INTERNET 权限 + OAuth intent-filter。
- **libs/** 当前存在**旧 GDT SDK** `GDTSDK.unionNormal.4.701.1571.aar`（腾讯优量汇，上一版计划遗留）→ **需删除**，换为穿山甲 `open_ad_sdk_7.7.1.6.aar`。
- **MainActivity** [android/app/src/main/kotlin/cn/dstoolkit/dstoolkit_app/MainActivity.kt](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/src/main/kotlin/cn/dstoolkit/dstoolkit_app/MainActivity.kt)：Flutter Activity，待加 MethodChannel。

### SDK 包（7eacace3eb1a7c1a9017ad4d40adc531.zip）
- 内层包名 `穿山甲Android_sdk_7.7.1.6_双架构.zip`，关键产物：
  - `open_ad_sdk_7.7.1.6.aar`（11.8MB，**主 SDK**，必选）
  - `tools-release.aar`（809KB，demo 注释标为"测试工具"，**生产可不含**）
  - `adapter/` + `adn/`（GDT/KS/sigmob/baidu/windAd 聚合适配器，**用户仅用穿山甲自有库存，全部跳过**）
- demo 关键参考：`RewardVideoActivity.java`（激励视频加载/展示流程）、`TTAdManagerHolder.java`（`TTAdSdk.init` 配置 `appId/appName/useMediation/debug`）。

### 穿山甲服务端激励回调规范（已核实，来源 csjplatform.com/supportcenter/5381、/60471d04...）
- **方式**：GET（穿山甲服务端→开发者回调 URL），开发者可自行拼接内部标识。本实现同时接受 GET+POST 兜底。
- **参数**：`user_id`、`trans_id`、`reward_name`、`reward_amount`、`extra`、`sign`。
- **签名**：`sign = sha256(SecurityKey + ":" + trans_id)`（SecurityKey 在穿山甲媒体平台编辑代码位 104441730 的回调配置处获得）。
- **返回**：JSON `{"isValid": true}` 表示发放奖励；`{"isValid": false}` 拒绝。
- 客户端需 `AdSlot.Builder().setUserID(userId)` 把用户 ID 透传给回调的 `user_id`。

---

## Proposed Changes（改动清单）

### A. 后端

#### A1. Prisma schema — 新增广告权益表与 User 字段
**文件** [backend/prisma/schema.prisma](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/prisma/schema.prisma)

- `User` 新增 3 字段：
  - `adRewardTier Tier?`（当日广告 boost 等级：PRO 或 PLUS；null=无活跃 boost）
  - `adRewardExpiresAt DateTime?`（当日 boost 到期，=当日 23:59:59 本地）
  - （连击不落库为标志，实时由 AdDailyLog 计算，避免中断状态不一致）
- 新增 `AdWatch` 模型（幂等记录每次验签通过的观看）：
  - `id`, `userId Int`, `user User @relation`, `transId String @unique`, `rewardAmount Int`, `watchedAt DateTime`, `createdAt`
  - `@@index([userId])`、`@@index([watchedAt])`
- 新增 `AdDailyLog` 模型（每日计数 + 连击计算依据）：
  - `id`, `userId Int`, `user User @relation`, `date String`（"YYYY-MM-DD"，服务器本地 Asia/Shanghai）, `count Int @default(0)`, `updatedAt`
  - `@@unique([userId, date])`、`@@index([userId])`
- 执行 `prisma db push` 建表（生产）。

#### A2. env 配置
**文件** [backend/src/config/env.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/config/env.ts)

- 新增：
  - `csjRewardSecurityKey: process.env.CSJ_REWARD_SECURITY_KEY || ''`（穿山甲回调验签密钥；空→严格拒绝所有回调）
  - `csjRewardAppId: process.env.CSJ_REWARD_APP_ID || '5873937'`（仅用于校验回调 user_id 来源一致性/日志）
  - `csjRewardCodeId: process.env.CSJ_REWARD_CODE_ID || '104441730'`

#### A3. 广告权益核心服务
**文件** `backend/src/services/ads.ts`（新建）

导出：
- `verifyCsjSign({transId, sign, securityKey}): boolean` — `sha256(`${securityKey}:${transId}`) === sign.toLowerCase()`。
- `endOfToday(date=new Date()): Date` — 本地（Asia/Shanghai）当日 23:59:59。用 `Intl`/手动偏移；服务器时区已为 Asia/Shanghai，直接用本地日界 +1day 0:0:0 减 1ms。
- `computeStreak(userId, todayStr): Promise<number>` — 自今日向前数连续 `count>=5` 的天数（今日未满 5 则连击不含今日，但"昨日连击"用于决策）。实现：查最近 4 天 AdDailyLog，循环判定。
- `grantDailyAdReward(userId): Promise<{tier, expiresAt, streak, todayCount}>` — 在第 5 次到达时调用：
  1. `yesterdayStreak = computeStreak(userId, yesterday)`（昨日及之前连续达标天数）
  2. `newStreak = yesterdayStreak + 1`
  3. `rewardTier = newStreak >= 3 ? 'PLUS' : 'PRO'`
  4. `prisma.user.update({ adRewardTier: rewardTier, adRewardExpiresAt: endOfToday() })`
  5. 返回结果。
- `resolveEffectiveTierWithAdBoost(user): Tier` —
  ```
  paid = resolveEffectiveTier(user)
  boost = (user.adRewardTier && user.adRewardExpiresAt && user.adRewardExpiresAt > now) ? user.adRewardTier : null
  return boost && TIER_RANK[boost] > TIER_RANK[paid] ? boost : paid
  ```
- `recordAdWatch(payload): Promise<{recorded: boolean, granted?: {...}}>` — webhook 主入口：
  1. 验签 `verifyCsjSign`，失败→return `{recorded:false, reason:'bad_sign'}`（webhook 返回 `{isValid:false}`）。
  2. `userId = Number(payload.user_id)`；校验存在。
  3. 事务内：`prisma.adWatch.create({transId})`，唯一冲突(P2002)→幂等返回 `{recorded:false, reason:'dup'}`（仍返 isValid:true，因为本次本就有效）。
  4. `upsert AdDailyLog(userId, todayStr)` → `count += 1`（Prisma `update:{count:{increment:1}}`）。
  5. 若 `newCount === 5`（恰好第 5 次）→ 调 `grantDailyAdReward(userId)`；`>5` 不重复发放。
  6. 返回 `{recorded:true, granted}`。
- `getAdStatus(userId): Promise<AdStatusDTO>` — 给 `/api/ads/status` 用：`{ watchedToday, requiredDaily:5, streakDays, todayComplete, rewardTier(boost 或 null), rewardExpiresAt, nextRewardTier(newStreak>=3?PLUS:PRO) }`。

#### A4. 广告路由（用户侧）
**文件** `backend/src/routes/ads.routes.ts`（新建）

- `Router()`，`router.use(verifyApiToken)`（与 v1.routes 同鉴权：dstk_ token）。
- `GET /status` → `getAdStatus(req.user.id)` → res.json。
- （可选）`GET /history?days=30` → 返回近 N 日 AdDailyLog（App 画连击日历）。

#### A5. Webhook 路由（根路径，穿山甲回调）
**文件** [backend/src/index.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/index.ts)

- 在 `app.use('/api/...')` 系列之前/之后，**根路径**注册：
  ```ts
  app.get('/webhoook/verify', asyncHandler(handleCsjCallback))   // 穿山甲默认 GET
  app.post('/webhoook/verify', asyncHandler(handleCsjCallback))   // 兜底 POST
  ```
- `handleCsjCallback`：从 `req.query`（GET）或 `req.body`（POST）取 `user_id/trans_id/reward_name/reward_amount/extra/sign`；调 `recordAdWatch`；无论结果返回 `{"isValid": recorded || dup}`（dup 视为 true，因为该 transId 本就有效）。验签失败/异常返回 `{"isValid": false}`。**注意拼写 `webhoook` 原样**。
- 部署提示：若 nginx 仅转发 `/api/*`，需新增 `location /webhoook/ { proxy_pass http://127.0.0.1:3000; }`。

#### A6. /me 与 /subscription/status 返回 ad-boost 后的有效等级
**文件** [backend/src/routes/v1.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/v1.routes.ts#L24-L31)
- `/me` select 增加 `adRewardTier/adRewardExpiresAt`；`tier` 字段返回 `resolveEffectiveTierWithAdBoost(user)`（有效=max(付费,boost)）；并附 `adRewardTier/adRewardExpiresAt` 便于前端区分。

**文件** [backend/src/services/subscription.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/services/subscription.ts)
- `getTierStatus`：`effectiveTier` 改用 `resolveEffectiveTierWithAdBoost(user)`；`TierStatus` 增 `adRewardTier/adRewardExpiresAt`。

**文件** [backend/src/utils/quota.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/utils/quota.ts)
- `checkUploadQuota`：将内部 `resolveEffectiveTier` 调用替换为 `resolveEffectiveTierWithAdBoost`（需 select 含 ad 字段），使 boost 期间享受 PRO/PLUS 配额。

### B. Flutter App

#### B1. Android 原生 SDK 接入
- **删除** [android/app/libs/GDTSDK.unionNormal.4.701.1571.aar](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/libs/GDTSDK.unionNormal.4.701.1571.aar)（旧 GDT，已弃用）。
- **新增** `android/app/libs/open_ad_sdk_7.7.1.6.aar`（从 zip 内 `穿山甲Android_sdk_7.7.1.6_双架构.zip/open_ad_sdk_7.7.1.6.aar` 解出）。仅此一个 AAR（不含 tools-release 与聚合 adapter）。

**文件** [android/app/build.gradle.kts](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/build.gradle.kts)
- `defaultConfig` 内 `minSdk = max(flutter.minSdkVersion, 21)`（穿山甲要求 ≥21；若已是 21+ 免动）。
- `android{}` 内 `ndk { abiFilters += listOf("armeabi-v7a","arm64-v8a","x86_64") }`（穿山甲双架构含 armeabi/arm64，Flutter 默认 arm64；保 armeabi-v7a+arm64-v8a 兼容）。
- 新增 `dependencies {}` 块：
  ```kotlin
  dependencies {
      implementation(fileTree(mapOf("dir" to "libs", "include" to listOf("*.aar","*.jar"))))
      // 穿山甲 SDK 运行期依赖（兜底，AAR 未内嵌时）
      implementation("com.google.code.gson:gson:2.8.5")
      implementation("com.squareup.okhttp3:okhttp:3.12.1")
  }
  ```
  （若构建报缺类再补；尽量精简。）

**文件** [android/app/src/main/AndroidManifest.xml](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/src/main/AndroidManifest.xml)
- `<uses-permission>` 增（仅激励视频必需/常用，隐私最小化）：
  - `ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE`、`VIBRATE`、`REQUEST_INSTALL_PACKAGES`（下载类落地页用）。
  - 不加 `READ_PHONE_STATE`/`ACCESS_FINE_LOCATION`/`WRITE_EXTERNAL_STORAGE`（非必需，降低隐私敏感度）。
- `<application>` 内增 FileProvider：
  ```xml
  <provider android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false" android:grantUriPermissions="true">
    <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/csj_file_paths"/>
  </provider>
  ```
- 保留 `android:usesCleartextTraffic="true"`（debug 本机后端用）。

**文件** `android/app/src/main/res/xml/csj_file_paths.xml`（新建）
```xml
<paths><external-path name="csj_external" path="."/><files-path name="csj_files" path="."/></paths>
```

#### B2. MainActivity — MethodChannel 接激励视频
**文件** [android/app/src/main/kotlin/cn/dstoolkit/dstoolkit_app/MainActivity.kt](file:///home/pmfish/Documents/trae_projects/dstoolkit/flutter_app/android/app/src/main/kotlin/cn/dstoolkit/dstoolkit_app/MainActivity.kt)

- `MethodChannel("cn.dstoolkit/reward_ad")`，方法：
  - `loadAndShow(args:{userId:int})`：
    1. 懒初始化 `TTAdSdk.init(this, TTAdConfig.Builder().appId("5873937").appName("DsToolKit").useMediation(false).debug(false).build())`（仅首次）。
    2. `createAdNative()` → `AdSlot.Builder().setCodeId("104441730").setUserID(userId.toString()).setRewardAmount(5).setRewardName("会员权益").setAdLoadType(LOAD).build()` → `loadRewardVideoAd(slot, listener)`。
    3. listener `onRewardVideoCached(ad)` → `ad.setRewardAdInteractionListener(...)` → `ad.showRewardVideoAd(this@MainActivity)`。
    4. `onAdClosed`/`onRewardArrived` → `result.success(mapOf("result" to "completed"))`；`onError` → `result.success(mapOf("result" to "failed","error" to msg))`。
    5. 超时（15s 未缓存）→ `result.success("failed","timeout")`。
- iOS（Cupertino）返回 `result.notImplemented()`；Dart 侧据此提示"仅支持 Android"。

#### B3. Dart 侧广告模块（新）
- **`lib/core/constants/api_constants.dart`**：加 `static const adCodeId = '104441730';`、`static const csjAppId = '5873937';`。
- **`lib/data/api/ads_api.dart`**：`AdsApi(Dio)` → `Future<AdRewardStatus> status()` 调 `GET /api/ads/status`。
- **`lib/data/models/models.dart`**：加 `class AdRewardStatus { watchedToday, requiredDaily, streakDays, todayComplete, rewardTier, rewardExpiresAt, nextRewardTier }` + `fromJson`。
- **`lib/features/ad_reward/reward_ad_channel.dart`**：`MethodChannel('cn.dstoolkit/reward_ad')` → `Future<{result,error}> loadAndShow(int userId)`；`bool get isAndroid`。
- **`lib/features/ad_reward/ad_reward_controller.dart`**：Riverpod `StateNotifier<AdRewardState>`：
  - `refresh()` → `AdsApi.status()`。
  - `watchAd(int userId)` → 调 channel `loadAndShow`；关闭后轮询 `status()` 3 次（0s/1.5s/3s）直到 `watchedToday` 自增或超时；更新状态。
- **`lib/features/ad_reward/ad_reward_page.dart`**：Neu-morphism UI：
  - 顶部权益卡：今日 boost 等级徽章（PRO/PLUS 或"无"）+ 到期时间。
  - 进度条 `watchedToday / 5`；连击天数徽章；"今日看满 5 次可获得 {nextRewardTier}" 提示。
  - 大按钮"观看广告 (+1)"：非 Android 禁用并提示；未登录禁用。
  - 观看后自动刷新进度。
  - 连击规则说明小字。

#### B4. 个人页入口 + 路由
- **`lib/core/router/app_router.dart`**：加 `GoRoute('/ad-reward', builder: => AdRewardPage())`。
- **`lib/features/profile/profile_page.dart`**（已登录分支，"当前等级"条目下方）：加 `_NeuListTile(icon: Icons.play_circle_rounded, title:'看广告领 Pro/Plus', trailing: 进度小徽章, onTap: => context.push('/ad-reward'))`。游客分支：在"查看定价方案"上方加同入口但 onTap 提示"登录后可用"。

---

## Assumptions & Decisions（假设与决策）

1. **SDK 选型**：仅穿山甲自有库存（`open_ad_sdk_7.7.1.6.aar`，`useMediation=false`），不含 GroMore 聚合适配器；删除旧 GDT AAR。用户给的 doc/APPID/codeId 均为穿山甲体系。
2. **权益叠加不降级**：`effective = max(付费有效等级, 广告boost)`。FREE 用户看满 5 次得 PRO 当日；PRO 付费用户连 3 天得 PLUS 当日（boost 高于付费时生效）；绝不把 PLUS/ULTIMATE 付费用户降为 PRO。
3. **规则**：连击 = 连续"每日≥5 次"的天数；第 5 次到达时 `newStreak=yesterdayStreak+1`，`≥3→PLUS` 否则 `PRO`；中断一天连击清零，次日回退 PRO。无永久解锁标志。
4. **Security Key**：env `CSJ_REWARD_SECURITY_KEY`；空值→严格拒绝所有回调（`{isValid:false}`+错误日志），避免误开 insecure 模式。用户须在 `backend/.env` 填入。
5. **webhook 路径**：根路径 `/webhoook/verify`（三连 o 原样，按用户后台配置）；GET+POST 都接。部署需 nginx 转发该路径到后端。
6. **时区**：服务器 Asia/Shanghai；`AdDailyLog.date` 用本地日界；`adRewardExpiresAt`=当日 23:59:59。
7. **幂等**：`AdWatch.transId @unique` 防重放/重试；重复 transId 不再计数但仍返 `isValid:true`。
8. **登录前提**：广告权益需 `setUserID=真实用户ID`，故游客不能领取（入口对游客提示登录）。这与"游客可浏览"一致。
9. **iOS**：仅 Android 接入（用户仅提供 Android SDK）；iOS 侧 channel 返回 unsupported，UI 提示"仅支持 Android"。
10. **权限最小化**：不加 READ_PHONE_STATE/定位/存储权限，降低隐私审核风险；激励视频功能不受影响。
11. **/me 的 tier 字段语义变更**：从"付费等级"改为"有效等级(max)"；App 等级徽章据此显示当前（含 boost）等级。已加 `adRewardTier` 字段供区分来源。

---

## Verification（验证步骤）

### 后端
1. `cd backend && pnpm exec prisma generate`（或 `node node_modules/prisma/build/index.js generate` 绕过 pnpm builds 检查）。
2. `node node_modules/typescript/bin/tsc -p tsconfig.json`（或 `pnpm run build`）零报错。
3. 单元/手测：
   - 启动后端 `./node_modules/.bin/tsx watch src/index.ts`。
   - 模拟穿山甲回调：`curl 'http://localhost:3000/webhoook/verify?user_id=1&trans_id=t1&reward_name=x&reward_amount=5&extra=&sign=<sha256(key:t1)>'` → 返回 `{"isValid":true}`；再请求同 trans_id → 仍 `true` 但不增计数。
   - 错误 sign → `{"isValid":false}`。
   - 连发 5 次不同 trans_id → 第 5 次后 `GET /api/ads/status`（带 dstk_ token）显示 `watchedToday=5, rewardTier=PRO, streakDays=1`；`/api/v1/me` 的 `tier=PRO`。
   - 改系统日期或用测试参数模拟连续 3 天达标 → 第 3 天第 5 次后 `rewardTier=PLUS, streakDays=3`。
   - 中断一天 → 次日第 5 次后 `rewardTier=PRO, streakDays=1`。
4. `prisma db push` 建表（含 AdWatch/AdDailyLog + User 新字段）。

### Flutter
5. `cd flutter_app && flutter analyze` 零告警。
6. `flutter test` 通过。
7. `flutter build apk --release`（JDK 21，路径同既往）成功，产物 `build/app/outputs/flutter-apk/app-release.apk`。
8. 真机手测（需登录 + 后端已部署 + 穿山甲后台已配回调与 Security Key）：
   - 个人页 →"看广告领 Pro/Plus"→ 观看完整激励视频 → 进度 +1；连看 5 次后等级徽章变 PRO、个人页"当前等级"同步。
   - 连续 3 天各 5 次 → 第 3 天变 PLUS。
   - 中断一天 → 次日回退 PRO。
   - iOS 设备/模拟器入口提示"仅支持 Android"。
