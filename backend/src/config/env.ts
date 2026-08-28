import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`缺少环境变量: ${name}`)
  return v
}

const meiliHost = process.env.MEILISEARCH_HOST || ''

// ═══════════ 分享 / 卡密外部校验配置 ═══════════
const kufakaApiUrl = process.env.KUFAKA_API_URL || ''
const kufakaApiKey = process.env.KUFAKA_API_KEY || ''
const kufakaEnabled = !!(kufakaApiUrl && kufakaApiKey)

// ═══════════ Git 仓库 & 通用装配配置 ═══════════
// 仓库根目录：每个用户一个 {username}.git 子目录
const gitReposRoot = process.env.GIT_REPOS_ROOT || 'data/git-repos'
// Git HTTP 服务基础地址（用户做 git clone 的地址前缀）
const gitHttpBase = process.env.GIT_HTTP_BASE || ''
// Git 提交者信息（系统自动提交时使用）
const gitBotName = process.env.GIT_BOT_NAME || 'dstoolkit-bot'
const gitBotEmail = process.env.GIT_BOT_EMAIL || 'bot@dstoolkit.local'
// 是否启用 Git 智能 HTTP 协议（git clone/push/pull over HTTP）
const gitHttpEnabled = !['0', 'false', 'no', ''].includes((process.env.GIT_HTTP_ENABLED || '1').toLowerCase())
// 单个仓库最大尺寸（MB）
const gitMaxRepoSizeMB = Number(process.env.GIT_MAX_REPO_SIZE_MB || 2048)
// 自动提交间隔（秒，0 表示不做定时自动提交，只在写入 API 时提交）
const gitAutoCommitSec = Number(process.env.GIT_AUTO_COMMIT_SEC || 0)
// 行业研究插件连接器默认配置（允许用户在仓库中覆写）
const industryResearcherDefaults = {
  // 支持的外部服务名（与 connector.json 中保持一致）
  providers: ['tdx', 'ifind', 'eastmoney', 'wind-aifin'],
  // 流水线运行超时时间（毫秒）
  pipelineTimeoutMs: Number(process.env.ASSEMBLY_PIPELINE_TIMEOUT_MS || 5 * 60 * 1000),
  // 并发流水线数
  maxConcurrentRuns: Number(process.env.ASSEMBLY_MAX_CONCURRENT || 2),
}

// ═══════════ 支付配置（预留） ═══════════
// 微信支付 / 支付宝：仅在填入完整商户凭证后开启；否则前端自动回退到卡密充值。
// 卡密为兜底方案：永久有效，与 https://github.com/lastmilk/dstoolkit/tree/main/kami 对应。
const wechatPayEnabled =
  !!(process.env.PAYMENT_WECHAT_APPID &&
     process.env.PAYMENT_WECHAT_MCHID &&
     process.env.PAYMENT_WECHAT_APIV3KEY)
const alipayEnabled =
  !!(process.env.PAYMENT_ALIPAY_APPID &&
     process.env.PAYMENT_ALIPAY_PRIVATE_KEY &&
     process.env.PAYMENT_ALIPAY_PUBLIC_KEY)

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://localhost:5174',
  port: Number(process.env.PORT || 3000),
  deepseekApiBase: process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com',
  // 服务端 AI 调用密钥（摘要/整理/导出润色等增值操作）
  deepseekServerKey: process.env.DEEPSEEK_SERVER_API_KEY || '',
  aesKey: required('AES_KEY'),
  meiliHost,
  meiliApiKey: process.env.MEILISEARCH_API_KEY || '',
  meiliEnabled: !!meiliHost,
  // 公开分享基础地址（用于生成 /s/<slug> 短链）
  shareBaseUrl: process.env.SHARE_BASE_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  // kufaka 卡密外部校验（未配置则降级为本地卡密校验）
  kufakaEnabled,
  kufakaApiUrl,
  kufakaApiKey,
  // 支付配置（预留）
  payment: {
    wechat: {
      enabled: wechatPayEnabled,
      appid: process.env.PAYMENT_WECHAT_APPID || '',
      mchid: process.env.PAYMENT_WECHAT_MCHID || '',
      apiV3Key: process.env.PAYMENT_WECHAT_APIV3KEY || '',
      certSerial: process.env.PAYMENT_WECHAT_CERT_SERIAL || '',
      privateKeyPath: process.env.PAYMENT_WECHAT_PRIVATE_KEY_PATH || '',
      notifyUrl: process.env.PAYMENT_WECHAT_NOTIFY_URL || '',
    },
    alipay: {
      enabled: alipayEnabled,
      appid: process.env.PAYMENT_ALIPAY_APPID || '',
      privateKey: process.env.PAYMENT_ALIPAY_PRIVATE_KEY || '',
      publicKey: process.env.PAYMENT_ALIPAY_PUBLIC_KEY || '',
      gateway: process.env.PAYMENT_ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      notifyUrl: process.env.PAYMENT_ALIPAY_NOTIFY_URL || '',
    },
    cardkey: {
      // 卡密目录：与 https://github.com/lastmilk/dstoolkit/tree/main/kami 对应
      // 默认指向 backend/assest/kami（与现有 assest 目录保持一致拼写）
      dir: process.env.PAYMENT_CARD_KEY_DIR || 'assest/kami',
      // 卡密购买页
      shopUrl: process.env.PAYMENT_CARD_KEY_SHOP_URL || 'https://www.kufaka.com/shop/DLJTWXUW',
      // 卡密说明文档
      docsUrl: process.env.PAYMENT_CARD_KEY_DOCS_URL || 'https://github.com/lastmilk/dstoolkit/tree/main/kami',
    },
  },
  // ═══════════ Git 仓库 & 通用装配 ═══════════
  git: {
    reposRoot: gitReposRoot,
    httpBase: gitHttpBase,
    httpEnabled: gitHttpEnabled,
    maxRepoSizeMB: gitMaxRepoSizeMB,
    autoCommitSec: gitAutoCommitSec,
    botName: gitBotName,
    botEmail: gitBotEmail,
  },
  industryResearcher: industryResearcherDefaults,
}

