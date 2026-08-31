// =======================================================================
// git_types.dart
// Dart 数据模型 — 与共享包 @dstoolkit/git-core / Prisma schema 保持一致
// 支持 fromJson / toJson 序列化，完整覆盖所有实体与枚举
// =======================================================================

/// RepoVisibility
enum RepoVisibility { PRIVATE, UNLISTED, PUBLIC }

RepoVisibility repoVisibilityFromJson(String s) => RepoVisibility.values.firstWhere(
      (e) => e.name == s,
      orElse: () => RepoVisibility.PRIVATE,
    );
String repoVisibilityToJson(RepoVisibility v) => v.name;

/// GitRepoType
enum GitRepoType { CONVERSATION, STANDARD }

GitRepoType gitRepoTypeFromJson(String s) => GitRepoType.values.firstWhere(
      (e) => e.name == s,
      orElse: () => GitRepoType.STANDARD,
    );
String gitRepoTypeToJson(GitRepoType v) => v.name;

/// ProtectionLevel
enum ProtectionLevel { NONE, PROTECTED, LOCKED }

ProtectionLevel protectionLevelFromJson(String s) => ProtectionLevel.values.firstWhere(
      (e) => e.name == s,
      orElse: () => ProtectionLevel.NONE,
    );
String protectionLevelToJson(ProtectionLevel v) => v.name;

/// MergeStrategy
enum MergeStrategy {
  FAST_FORWARD_ONLY,
  THREE_WAY,
  SQUASH,
  REBASE,
  OURS,
  THEIRS,
}

MergeStrategy mergeStrategyFromJson(String s) => MergeStrategy.values.firstWhere(
      (e) => e.name == s,
      orElse: () => MergeStrategy.THREE_WAY,
    );
String mergeStrategyToJson(MergeStrategy v) => v.name;

/// ResetMode
enum ResetMode { SOFT, MIXED, HARD }

ResetMode resetModeFromJson(String s) => ResetMode.values.firstWhere(
      (e) => e.name == s,
      orElse: () => ResetMode.MIXED,
    );
String resetModeToJson(ResetMode v) => v.name;

/// PullRequestStatus
enum PullRequestStatus {
  DRAFT,
  OPEN,
  REVIEW,
  APPROVED,
  CHANGES_REQUESTED,
  MERGED,
  CLOSED,
}

PullRequestStatus pullRequestStatusFromJson(String s) => PullRequestStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => PullRequestStatus.OPEN,
    );
String pullRequestStatusToJson(PullRequestStatus v) => v.name;

/// PRReviewStatus
enum PRReviewStatus { APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING }

PRReviewStatus prReviewStatusFromJson(String s) => PRReviewStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => PRReviewStatus.PENDING,
    );
String prReviewStatusToJson(PRReviewStatus v) => v.name;

// -----------------------------------------------------------------------
// 实体：GitRepoEntity
// -----------------------------------------------------------------------
class GitRepoEntity {
  final int id;
  final String name;
  final String? description;
  final RepoVisibility visibility;
  final GitRepoType type;
  final int? ownerId;
  final int? conversationId;
  final String? defaultBranchName;
  final int commitCount;
  final int branchCount;
  final int tagCount;
  final int? pullRequestCount;
  final int? starCount;
  final String createdAt;
  final String updatedAt;

  GitRepoEntity({
    required this.id,
    required this.name,
    this.description,
    required this.visibility,
    required this.type,
    this.ownerId,
    this.conversationId,
    this.defaultBranchName,
    this.commitCount = 0,
    this.branchCount = 0,
    this.tagCount = 0,
    this.pullRequestCount,
    this.starCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory GitRepoEntity.fromJson(Map<String, dynamic> j) => GitRepoEntity(
        id: j['id'] as int,
        name: j['name'] as String? ?? 'repo',
        description: j['description'] as String?,
        visibility: repoVisibilityFromJson(j['visibility'] as String? ?? 'PRIVATE'),
        type: gitRepoTypeFromJson(j['type'] as String? ?? 'STANDARD'),
        ownerId: j['ownerId'] as int?,
        conversationId: j['conversationId'] as int?,
        defaultBranchName: j['defaultBranchName'] as String?,
        commitCount: (j['commitCount'] as num?)?.toInt() ?? 0,
        branchCount: (j['branchCount'] as num?)?.toInt() ?? 0,
        tagCount: (j['tagCount'] as num?)?.toInt() ?? 0,
        pullRequestCount: (j['pullRequestCount'] as num?)?.toInt(),
        starCount: (j['starCount'] as num?)?.toInt(),
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        updatedAt: j['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (description != null) 'description': description,
        'visibility': repoVisibilityToJson(visibility),
        'type': gitRepoTypeToJson(type),
        if (ownerId != null) 'ownerId': ownerId,
        if (conversationId != null) 'conversationId': conversationId,
        if (defaultBranchName != null) 'defaultBranchName': defaultBranchName,
        'commitCount': commitCount,
        'branchCount': branchCount,
        'tagCount': tagCount,
        if (pullRequestCount != null) 'pullRequestCount': pullRequestCount,
        if (starCount != null) 'starCount': starCount,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

// -----------------------------------------------------------------------
// 实体：GitBranchEntity
// -----------------------------------------------------------------------
class GitBranchEntity {
  final int id;
  final int repoId;
  final String name;
  final bool isDefault;
  final ProtectionLevel protectionLevel;
  final List<int>? requiredReviewerIds;
  final int? headCommitId;
  final String? headCommitSha;
  final int commitCount;
  final String createdAt;
  final String updatedAt;

  GitBranchEntity({
    required this.id,
    required this.repoId,
    required this.name,
    required this.isDefault,
    required this.protectionLevel,
    this.requiredReviewerIds,
    this.headCommitId,
    this.headCommitSha,
    required this.commitCount,
    required this.createdAt,
    required this.updatedAt,
  });

  factory GitBranchEntity.fromJson(Map<String, dynamic> j) => GitBranchEntity(
        id: j['id'] as int,
        repoId: j['repoId'] as int,
        name: j['name'] as String? ?? '',
        isDefault: j['isDefault'] as bool? ?? false,
        protectionLevel:
            protectionLevelFromJson(j['protectionLevel'] as String? ?? 'NONE'),
        requiredReviewerIds: (j['requiredReviewerIds'] as List<dynamic>?)
            ?.map((e) => e as int)
            .toList(),
        headCommitId: j['headCommitId'] as int?,
        headCommitSha: j['headCommitSha'] as String?,
        commitCount: (j['commitCount'] as num?)?.toInt() ?? 0,
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        updatedAt: j['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

// -----------------------------------------------------------------------
// 实体：GitTagEntity
// -----------------------------------------------------------------------
class GitTagEntity {
  final int id;
  final int repoId;
  final String name;
  final String targetCommitSha;
  final int targetCommitId;
  final String type; // TAG / ANNOTATED
  final String? title;
  final String? note;
  final int creatorId;
  final String creatorName;
  final String createdAt;

  GitTagEntity({
    required this.id,
    required this.repoId,
    required this.name,
    required this.targetCommitSha,
    required this.targetCommitId,
    required this.type,
    this.title,
    this.note,
    required this.creatorId,
    required this.creatorName,
    required this.createdAt,
  });

  factory GitTagEntity.fromJson(Map<String, dynamic> j) => GitTagEntity(
        id: j['id'] as int,
        repoId: j['repoId'] as int,
        name: j['name'] as String? ?? '',
        targetCommitSha: j['targetCommitSha'] as String? ?? '',
        targetCommitId: j['targetCommitId'] as int? ?? 0,
        type: j['type'] as String? ?? 'LIGHTWEIGHT',
        title: j['title'] as String?,
        note: j['note'] as String?,
        creatorId: j['creatorId'] as int? ?? 0,
        creatorName: j['creatorName'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

// -----------------------------------------------------------------------
// 实体：GitCommitEntity（含 parentLinks 便于构建DAG图）
// -----------------------------------------------------------------------
class GitCommitParentLink {
  final int parentId;
  final int parentOrder;
  final String? parentSha;
  GitCommitParentLink({
    required this.parentId,
    required this.parentOrder,
    this.parentSha,
  });
  factory GitCommitParentLink.fromJson(Map<String, dynamic> j) => GitCommitParentLink(
        parentId: j['parentId'] as int,
        parentOrder: (j['parentOrder'] as num?)?.toInt() ?? 0,
        parentSha: j['parent']?['sha256'] as String? ?? j['parentSha'] as String?,
      );
}

class GitCommitEntity {
  final int id;
  final int repoId;
  final String sha256;
  final String subject;
  final String? body;
  final int authorUserId;
  final String authorName;
  final String? authorEmail;
  final int committerUserId;
  final String committerName;
  final String committedAt;
  final int treeId;
  final int additions;
  final int deletions;
  final String? changeType;
  final bool isMerge;
  final List<GitCommitParentLink> parentLinks;

  GitCommitEntity({
    required this.id,
    required this.repoId,
    required this.sha256,
    required this.subject,
    this.body,
    required this.authorUserId,
    required this.authorName,
    this.authorEmail,
    required this.committerUserId,
    required this.committerName,
    required this.committedAt,
    required this.treeId,
    required this.additions,
    required this.deletions,
    this.changeType,
    required this.isMerge,
    required this.parentLinks,
  });

  factory GitCommitEntity.fromJson(Map<String, dynamic> j) => GitCommitEntity(
        id: j['id'] as int,
        repoId: j['repoId'] as int,
        sha256: j['sha256'] as String? ?? '',
        subject: j['subject'] as String? ?? '',
        body: j['body'] as String?,
        authorUserId: j['authorUserId'] as int? ?? 0,
        authorName: j['authorName'] as String? ?? 'unknown',
        authorEmail: j['authorEmail'] as String?,
        committerUserId: j['committerUserId'] as int? ?? 0,
        committerName: j['committerName'] as String? ?? 'unknown',
        committedAt:
            j['committedAt'] as String? ?? DateTime.now().toIso8601String(),
        treeId: j['treeId'] as int? ?? 0,
        additions: (j['additions'] as num?)?.toInt() ?? 0,
        deletions: (j['deletions'] as num?)?.toInt() ?? 0,
        changeType: j['changeType'] as String?,
        isMerge: j['isMerge'] as bool? ?? false,
        parentLinks: (j['parentLinks'] as List<dynamic>? ?? const [])
            .map((e) => GitCommitParentLink.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

// -----------------------------------------------------------------------
// Diff 相关
// -----------------------------------------------------------------------
enum DiffOp { INSERT, DELETE, EQUAL }

DiffOp diffOpFromJson(String s) =>
    DiffOp.values.firstWhere((e) => e.name == s, orElse: () => DiffOp.EQUAL);

class DiffToken {
  final DiffOp op;
  final String text;
  DiffToken(this.op, this.text);
  factory DiffToken.fromJson(Map<String, dynamic> j) =>
      DiffToken(diffOpFromJson(j['op'] as String? ?? 'EQUAL'), j['text'] as String? ?? '');
}

class DiffLine {
  final DiffOp op;
  final String content;
  final int? oldLineNo;
  final int? newLineNo;
  final List<DiffToken> tokens;
  DiffLine({
    required this.op,
    required this.content,
    this.oldLineNo,
    this.newLineNo,
    required this.tokens,
  });
  factory DiffLine.fromJson(Map<String, dynamic> j) => DiffLine(
        op: diffOpFromJson(j['op'] as String? ?? 'EQUAL'),
        content: j['content'] as String? ?? '',
        oldLineNo: (j['oldLineNo'] as num?)?.toInt(),
        newLineNo: (j['newLineNo'] as num?)?.toInt(),
        tokens: (j['tokens'] as List<dynamic>? ?? const [])
            .map((e) => DiffToken.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class DiffHunk {
  final int oldStart;
  final int oldCount;
  final int newStart;
  final int newCount;
  final String? sectionHeader;
  final List<DiffLine> lines;
  DiffHunk({
    required this.oldStart,
    required this.oldCount,
    required this.newStart,
    required this.newCount,
    this.sectionHeader,
    required this.lines,
  });
  factory DiffHunk.fromJson(Map<String, dynamic> j) => DiffHunk(
        oldStart: (j['oldStart'] as num?)?.toInt() ?? 0,
        oldCount: (j['oldCount'] as num?)?.toInt() ?? 0,
        newStart: (j['newStart'] as num?)?.toInt() ?? 0,
        newCount: (j['newCount'] as num?)?.toInt() ?? 0,
        sectionHeader: j['sectionHeader'] as String?,
        lines: (j['lines'] as List<dynamic>? ?? const [])
            .map((e) => DiffLine.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

enum DiffFileStatus { added, deleted, modified, renamed, copied, unchanged, conflict }

DiffFileStatus diffFileStatusFromJson(String s) =>
    DiffFileStatus.values.firstWhere((e) => e.name == s, orElse: () => DiffFileStatus.modified);

class DiffFileResult {
  final DiffFileStatus status;
  final String? oldPath;
  final String newPath;
  final String? oldSha;
  final String? newSha;
  final int? similarity;
  final int additions;
  final int deletions;
  final List<DiffHunk> hunks;
  DiffFileResult({
    required this.status,
    this.oldPath,
    required this.newPath,
    this.oldSha,
    this.newSha,
    this.similarity,
    required this.additions,
    required this.deletions,
    required this.hunks,
  });
  factory DiffFileResult.fromJson(Map<String, dynamic> j) => DiffFileResult(
        status: diffFileStatusFromJson(j['status'] as String? ?? 'modified'),
        oldPath: j['oldPath'] as String?,
        newPath: j['newPath'] as String? ?? '',
        oldSha: j['oldSha'] as String?,
        newSha: j['newSha'] as String?,
        similarity: (j['similarity'] as num?)?.toInt(),
        additions: (j['additions'] as num?)?.toInt() ?? 0,
        deletions: (j['deletions'] as num?)?.toInt() ?? 0,
        hunks: (j['hunks'] as List<dynamic>? ?? const [])
            .map((e) => DiffHunk.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class DiffResult {
  final String? fromCommitSha;
  final String toCommitSha;
  final int additions;
  final int deletions;
  final List<DiffFileResult> files;
  DiffResult({
    this.fromCommitSha,
    required this.toCommitSha,
    required this.additions,
    required this.deletions,
    required this.files,
  });
  factory DiffResult.fromJson(Map<String, dynamic> j) => DiffResult(
        fromCommitSha: j['fromCommitSha'] as String?,
        toCommitSha: j['toCommitSha'] as String? ?? '',
        additions: (j['additions'] as num?)?.toInt() ?? 0,
        deletions: (j['deletions'] as num?)?.toInt() ?? 0,
        files: (j['files'] as List<dynamic>? ?? const [])
            .map((e) => DiffFileResult.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

// -----------------------------------------------------------------------
// Reflog / PR / Comment / Review / Activity
// -----------------------------------------------------------------------
class ReflogEntryEntity {
  final int id;
  final int repoId;
  final String branchName;
  final int indexInBranch;
  final String operation;
  final String? oldCommitSha;
  final String? newCommitSha;
  final String? details;
  final int? actorId;
  final String actorName;
  final String createdAt;
  ReflogEntryEntity({
    required this.id,
    required this.repoId,
    required this.branchName,
    required this.indexInBranch,
    required this.operation,
    this.oldCommitSha,
    this.newCommitSha,
    this.details,
    this.actorId,
    required this.actorName,
    required this.createdAt,
  });
  factory ReflogEntryEntity.fromJson(Map<String, dynamic> j) => ReflogEntryEntity(
        id: j['id'] as int,
        repoId: j['repoId'] as int,
        branchName: j['branchName'] as String? ?? '',
        indexInBranch: (j['indexInBranch'] as num?)?.toInt() ?? 0,
        operation: j['operation'] as String? ?? 'UNKNOWN',
        oldCommitSha: j['oldCommitSha'] as String?,
        newCommitSha: j['newCommitSha'] as String?,
        details: j['details'] as String?,
        actorId: j['actorId'] as int?,
        actorName: j['actorName'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

class PullRequestEntity {
  final int id;
  final int repoId;
  final int number;
  final String title;
  final String? description;
  final PullRequestStatus status;
  final String baseBranchName;
  final String headBranchName;
  final int authorId;
  final String authorName;
  final int? assigneeId;
  final int? mergeCommitId;
  final int? commitsAhead;
  final int? commitsBehind;
  final bool? mergeable;
  final String? mergeBlockedReason;
  final int? additions;
  final int? deletions;
  final int? changedFiles;
  final int? commentCount;
  final String createdAt;
  final String updatedAt;
  final String? mergedAt;
  final String? closedAt;
  PullRequestEntity({
    required this.id,
    required this.repoId,
    required this.number,
    required this.title,
    this.description,
    required this.status,
    required this.baseBranchName,
    required this.headBranchName,
    required this.authorId,
    required this.authorName,
    this.assigneeId,
    this.mergeCommitId,
    this.commitsAhead,
    this.commitsBehind,
    this.mergeable,
    this.mergeBlockedReason,
    this.additions,
    this.deletions,
    this.changedFiles,
    this.commentCount,
    required this.createdAt,
    required this.updatedAt,
    this.mergedAt,
    this.closedAt,
  });
  factory PullRequestEntity.fromJson(Map<String, dynamic> j) => PullRequestEntity(
        id: j['id'] as int,
        repoId: j['repoId'] as int,
        number: j['number'] as int? ?? 0,
        title: j['title'] as String? ?? '',
        description: j['description'] as String?,
        status: pullRequestStatusFromJson(j['status'] as String? ?? 'OPEN'),
        baseBranchName: j['baseBranchName'] as String? ?? '',
        headBranchName: j['headBranchName'] as String? ?? '',
        authorId: j['authorId'] as int? ?? 0,
        authorName: j['authorName'] as String? ?? '',
        assigneeId: j['assigneeId'] as int?,
        mergeCommitId: j['mergeCommitId'] as int?,
        commitsAhead: (j['commitsAhead'] as num?)?.toInt(),
        commitsBehind: (j['commitsBehind'] as num?)?.toInt(),
        mergeable: j['mergeable'] as bool?,
        mergeBlockedReason: j['mergeBlockedReason'] as String?,
        additions: (j['additions'] as num?)?.toInt(),
        deletions: (j['deletions'] as num?)?.toInt(),
        changedFiles: (j['changedFiles'] as num?)?.toInt(),
        commentCount: (j['commentCount'] as num?)?.toInt(),
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        updatedAt: j['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
        mergedAt: j['mergedAt'] as String?,
        closedAt: j['closedAt'] as String?,
      );
}

class PRCommentEntity {
  final int id;
  final int prId;
  final int authorId;
  final String authorName;
  final String body;
  final int? replyToId;
  final String? filePath;
  final int? lineNumber;
  final String? side; // LEFT / RIGHT
  final bool isResolved;
  final int? resolverId;
  final String createdAt;
  final String updatedAt;
  PRCommentEntity({
    required this.id,
    required this.prId,
    required this.authorId,
    required this.authorName,
    required this.body,
    this.replyToId,
    this.filePath,
    this.lineNumber,
    this.side,
    required this.isResolved,
    this.resolverId,
    required this.createdAt,
    required this.updatedAt,
  });
  factory PRCommentEntity.fromJson(Map<String, dynamic> j) => PRCommentEntity(
        id: j['id'] as int,
        prId: j['prId'] as int,
        authorId: j['authorId'] as int? ?? 0,
        authorName: j['authorName'] as String? ?? '',
        body: j['body'] as String? ?? '',
        replyToId: j['replyToId'] as int?,
        filePath: j['filePath'] as String?,
        lineNumber: (j['lineNumber'] as num?)?.toInt(),
        side: j['side'] as String?,
        isResolved: j['isResolved'] as bool? ?? false,
        resolverId: j['resolverId'] as int?,
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        updatedAt: j['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

class PRReviewEntity {
  final int id;
  final int prId;
  final int reviewerId;
  final String reviewerName;
  final PRReviewStatus status;
  final String? body;
  final String? commitSha;
  final String submittedAt;
  PRReviewEntity({
    required this.id,
    required this.prId,
    required this.reviewerId,
    required this.reviewerName,
    required this.status,
    this.body,
    this.commitSha,
    required this.submittedAt,
  });
  factory PRReviewEntity.fromJson(Map<String, dynamic> j) => PRReviewEntity(
        id: j['id'] as int,
        prId: j['prId'] as int,
        reviewerId: j['reviewerId'] as int? ?? 0,
        reviewerName: j['reviewerName'] as String? ?? '',
        status: prReviewStatusFromJson(j['status'] as String? ?? 'PENDING'),
        body: j['body'] as String?,
        commitSha: j['commitSha'] as String?,
        submittedAt: j['submittedAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

class PRActivityEntity {
  final int id;
  final int prId;
  final int? actorId;
  final String actorName;
  final String actionType;
  final String? description;
  final int? toCommentId;
  final int? toReviewId;
  final String? fieldName;
  final String? oldValue;
  final String? newValue;
  final String createdAt;
  PRActivityEntity({
    required this.id,
    required this.prId,
    this.actorId,
    required this.actorName,
    required this.actionType,
    this.description,
    this.toCommentId,
    this.toReviewId,
    this.fieldName,
    this.oldValue,
    this.newValue,
    required this.createdAt,
  });
  factory PRActivityEntity.fromJson(Map<String, dynamic> j) => PRActivityEntity(
        id: j['id'] as int,
        prId: j['prId'] as int,
        actorId: j['actorId'] as int?,
        actorName: j['actorName'] as String? ?? '',
        actionType: j['actionType'] as String? ?? 'UPDATE',
        description: j['description'] as String?,
        toCommentId: j['toCommentId'] as int?,
        toReviewId: j['toReviewId'] as int?,
        fieldName: j['fieldName'] as String?,
        oldValue: j['oldValue'] as String?,
        newValue: j['newValue'] as String?,
        createdAt: j['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      );
}

// -----------------------------------------------------------------------
// CompareResponse / 服务端 merge 结果
// -----------------------------------------------------------------------
class CompareResponse {
  final String base;
  final String head;
  final bool mergeable;
  final int additions;
  final int deletions;
  final int commitsBehind;
  final int commitsAhead;
  final List<DiffFileResult> files;
  final List<String> conflictFiles;
  CompareResponse({
    required this.base,
    required this.head,
    required this.mergeable,
    required this.additions,
    required this.deletions,
    required this.commitsBehind,
    required this.commitsAhead,
    required this.files,
    required this.conflictFiles,
  });
  factory CompareResponse.fromJson(Map<String, dynamic> j) => CompareResponse(
        base: j['base'] as String? ?? '',
        head: j['head'] as String? ?? '',
        mergeable: j['mergeable'] as bool? ?? false,
        additions: (j['additions'] as num?)?.toInt() ?? 0,
        deletions: (j['deletions'] as num?)?.toInt() ?? 0,
        commitsBehind: (j['commitsBehind'] as num?)?.toInt() ?? 0,
        commitsAhead: (j['commitsAhead'] as num?)?.toInt() ?? 0,
        files: (j['files'] as List<dynamic>? ?? const [])
            .map((e) => DiffFileResult.fromJson(e as Map<String, dynamic>))
            .toList(),
        conflictFiles: (j['conflictFiles'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
      );
}

class ServiceMergeResult {
  final String status; // CONFLICT / ALREADY_UP_TO_DATE / MERGED / FAST_FORWARD / ERROR
  final String message;
  final String? mergeCommitSha;
  final List<String>? conflictFiles;
  final MergeStrategy? strategyUsed;
  ServiceMergeResult({
    required this.status,
    required this.message,
    this.mergeCommitSha,
    this.conflictFiles,
    this.strategyUsed,
  });
  factory ServiceMergeResult.fromJson(Map<String, dynamic> j) => ServiceMergeResult(
        status: j['status'] as String? ?? 'ERROR',
        message: j['message'] as String? ?? '',
        mergeCommitSha: j['mergeCommitSha'] as String?,
        conflictFiles: (j['conflictFiles'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList(),
        strategyUsed: j['strategyUsed'] == null
            ? null
            : mergeStrategyFromJson(j['strategyUsed'] as String),
      );
}

// -----------------------------------------------------------------------
// Tree / File 列表
// -----------------------------------------------------------------------
class TreeFileItem {
  final String path;
  final String? mode;
  final int blobId;
  final String sha;
  final int sizeBytes;
  final String? mimeType;
  final int? messageId;
  TreeFileItem({
    required this.path,
    this.mode,
    required this.blobId,
    required this.sha,
    required this.sizeBytes,
    this.mimeType,
    this.messageId,
  });
  factory TreeFileItem.fromJson(Map<String, dynamic> j) => TreeFileItem(
        path: j['path'] as String? ?? '',
        mode: j['mode'] as String?,
        blobId: j['blobId'] as int? ?? 0,
        sha: j['sha'] as String? ?? '',
        sizeBytes: (j['sizeBytes'] as num?)?.toInt() ?? 0,
        mimeType: j['mimeType'] as String?,
        messageId: j['messageId'] as int?,
      );
}
