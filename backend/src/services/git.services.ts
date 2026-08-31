/**
 * Git 服务单例注册表
 * 所有路由共享同一份服务实例
 */
import { PrismaClient } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { GitObjectService } from './gitObject.service.js'
import { GitCommitService } from './gitCommit.service.js'
import { GitRepoService } from './gitRepo.service.js'
import { PullRequestService } from './pullRequest.service.js'

export const gitObjects = new GitObjectService(prisma)
export const gitCommits = new GitCommitService(prisma, gitObjects)
export const gitRepos = new GitRepoService(prisma, gitObjects, gitCommits)
export const pullRequests = new PullRequestService(prisma, gitRepos, gitObjects)
