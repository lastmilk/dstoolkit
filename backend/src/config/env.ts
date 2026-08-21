import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`缺少环境变量: ${name}`)
  return v
}

const meiliHost = process.env.MEILISEARCH_HOST || ''

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://localhost:5174',
  port: Number(process.env.PORT || 3000),
  deepseekApiBase: process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com',
  aesKey: required('AES_KEY'),
  meiliHost,
  meiliApiKey: process.env.MEILISEARCH_API_KEY || '',
  meiliEnabled: !!meiliHost,
}
