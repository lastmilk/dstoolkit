// 数据模型：与后端 /api/v1/* JSON 结构一一对应。

class User {
  const User({
    required this.id,
    required this.username,
    required this.role,
    required this.cloudSyncEnabled,
    required this.createdAt,
    this.tier = 'FREE',
    this.tierExpiresAt,
    this.isPermanentTier = false,
  });

  final int id;
  final String username;
  final String role;
  final bool cloudSyncEnabled;
  final DateTime? createdAt;
  final String tier;
  final DateTime? tierExpiresAt;
  final bool isPermanentTier;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: (json['id'] as num).toInt(),
        username: json['username'] as String,
        role: json['role'] as String,
        cloudSyncEnabled: json['cloudSyncEnabled'] as bool? ?? false,
        createdAt: json['createdAt'] == null
            ? null
            : DateTime.tryParse(json['createdAt'] as String),
        tier: json['tier'] as String? ?? 'FREE',
        tierExpiresAt: json['tierExpiresAt'] == null
            ? null
            : DateTime.tryParse(json['tierExpiresAt'] as String),
        isPermanentTier: json['isPermanentTier'] as bool? ?? false,
      );
}

class DeepseekConfig {
  const DeepseekConfig({
    required this.id,
    required this.name,
    required this.deepseekUserId,
    this.deepseekEmail,
    this.deepseekMobile,
    required this.conversationCount,
    required this.createdAt,
    required this.updatedAt,
  });

  final int id;
  final String name;
  final String deepseekUserId;
  final String? deepseekEmail;
  final String? deepseekMobile;
  final int conversationCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory DeepseekConfig.fromJson(Map<String, dynamic> json) => DeepseekConfig(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        deepseekUserId: json['deepseekUserId'] as String,
        deepseekEmail: json['deepseekEmail'] as String?,
        deepseekMobile: json['deepseekMobile'] as String?,
        conversationCount: (json['conversationCount'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
      );
}

/// 聊天记录仓库（Git 版本化）
class ChatRepo {
  const ChatRepo({
    required this.id,
    required this.name,
    this.description,
    this.defaultBranch = 'main',
    this.lastCommitSha,
    this.lastCommitAt,
    this.commitCount = 0,
    this.snapshotBytes,
    this.conversationCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  final int id;
  final String name;
  final String? description;
  final String defaultBranch;
  final String? lastCommitSha;
  final DateTime? lastCommitAt;
  final int commitCount;
  final int? snapshotBytes;
  final int conversationCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory ChatRepo.fromJson(Map<String, dynamic> json) => ChatRepo(
        id: (json['id'] as num).toInt(),
        name: json['name'] as String,
        description: json['description'] as String?,
        defaultBranch: json['defaultBranch'] as String? ?? 'main',
        lastCommitSha: json['lastCommitSha'] as String?,
        lastCommitAt: json['lastCommitAt'] == null
            ? null
            : DateTime.tryParse(json['lastCommitAt'] as String),
        commitCount: (json['commitCount'] as num?)?.toInt() ?? 0,
        snapshotBytes: (json['snapshotBytes'] as num?)?.toInt(),
        conversationCount: (json['conversationCount'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
      );
}

/// Git 提交历史条目
class RepoCommit {
  const RepoCommit({
    required this.sha,
    required this.shortSha,
    required this.message,
    required this.author,
    required this.date,
  });

  final String sha;
  final String shortSha;
  final String message;
  final String author;
  final DateTime? date;

  factory RepoCommit.fromJson(Map<String, dynamic> json) => RepoCommit(
        sha: json['sha'] as String,
        shortSha: json['shortSha'] as String,
        message: json['message'] as String? ?? '',
        author: json['author'] as String? ?? '',
        date: DateTime.tryParse(json['date'] as String? ?? ''),
      );
}

class ConversationLite {
  const ConversationLite({
    required this.id,
    required this.deepseekConvId,
    required this.title,
    required this.insertedAt,
    required this.updatedAt,
    required this.turnCount,
  });

  final int id;
  final String deepseekConvId;
  final String title;
  final DateTime? insertedAt;
  final DateTime? updatedAt;
  final int turnCount;

  factory ConversationLite.fromJson(Map<String, dynamic> json) =>
      ConversationLite(
        id: (json['id'] as num).toInt(),
        deepseekConvId: json['deepseekConvId'] as String,
        title: json['title'] as String? ?? '(无标题)',
        insertedAt: DateTime.tryParse(json['insertedAt'] as String? ?? ''),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
        turnCount: (json['turnCount'] as num?)?.toInt() ?? 0,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.nodeId,
    this.parentId,
    required this.role,
    this.model,
    required this.content,
    required this.insertedAt,
    this.turnIndex,
    this.versionIndex,
    this.subTurnIndex,
  });

  final int id;
  final String nodeId;
  final String? parentId;
  final String role; // USER / ASSISTANT
  final String? model;
  final String content;
  final DateTime? insertedAt;
  final int? turnIndex;
  final int? versionIndex;
  final int? subTurnIndex;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: (json['id'] as num).toInt(),
        nodeId: json['nodeId'] as String,
        parentId: json['parentId'] as String?,
        role: json['role'] as String? ?? 'USER',
        model: json['model'] as String?,
        content: json['content'] as String? ?? '',
        insertedAt: DateTime.tryParse(json['insertedAt'] as String? ?? ''),
        turnIndex: (json['turnIndex'] as num?)?.toInt(),
        versionIndex: (json['versionIndex'] as num?)?.toInt(),
        subTurnIndex: (json['subTurnIndex'] as num?)?.toInt(),
      );
}

/// Turn 树（与后端 aggregateTurnsFromMessages 输出对齐）
class SubTurn {
  const SubTurn({
    required this.subTurnIndex,
    required this.userNodeId,
    this.assistantNodeId,
  });

  final int subTurnIndex;
  final String userNodeId;
  final String? assistantNodeId;

  factory SubTurn.fromJson(Map<String, dynamic> json) => SubTurn(
        subTurnIndex: (json['subTurnIndex'] as num).toInt(),
        userNodeId: json['userNodeId'] as String? ?? '',
        assistantNodeId: json['assistantNodeId'] as String?,
      );
}

class TurnVersion {
  const TurnVersion({
    required this.versionIndex,
    required this.assistantNodeId,
    this.subTurns = const [],
  });

  final int versionIndex;
  final String assistantNodeId;
  final List<SubTurn> subTurns;

  factory TurnVersion.fromJson(Map<String, dynamic> json) => TurnVersion(
        versionIndex: (json['versionIndex'] as num).toInt(),
        assistantNodeId: json['assistantNodeId'] as String? ?? '',
        subTurns: (json['subTurns'] as List<dynamic>? ?? [])
            .map((e) => SubTurn.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Turn {
  const Turn({
    required this.turnIndex,
    required this.userNodeId,
    this.versions = const [],
  });

  final int turnIndex;
  final String userNodeId;
  final List<TurnVersion> versions;

  factory Turn.fromJson(Map<String, dynamic> json) => Turn(
        turnIndex: (json['turnIndex'] as num).toInt(),
        userNodeId: json['userNodeId'] as String? ?? '',
        versions: (json['versions'] as List<dynamic>? ?? [])
            .map((e) => TurnVersion.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class ConversationDetail {
  const ConversationDetail({
    required this.id,
    required this.deepseekConvId,
    required this.title,
    required this.messages,
    required this.turns,
    this.turnCount = 0,
    this.updatedAt,
  });

  final int id;
  final String deepseekConvId;
  final String title;
  final List<ChatMessage> messages;
  final List<Turn> turns;
  final int turnCount;
  final DateTime? updatedAt;

  factory ConversationDetail.fromJson(Map<String, dynamic> json) =>
      ConversationDetail(
        id: (json['id'] as num).toInt(),
        deepseekConvId: json['deepseekConvId'] as String,
        title: json['title'] as String? ?? '(无标题)',
        turnCount: (json['turnCount'] as num?)?.toInt() ?? 0,
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
        messages: (json['messages'] as List<dynamic>? ?? [])
            .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
            .toList(),
        turns: (json['turns'] as List<dynamic>? ?? [])
            .map((e) => Turn.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class SearchResult {
  const SearchResult({
    required this.configId,
    required this.convId,
    required this.nodeId,
    required this.title,
    required this.content,
    required this.role,
    this.turnIndex,
    this.versionIndex,
  });

  final int configId;
  final String convId;
  final String nodeId;
  final String title;
  final String content;
  final String role;
  final int? turnIndex;
  final int? versionIndex;

  factory SearchResult.fromJson(Map<String, dynamic> json) => SearchResult(
        configId: (json['configId'] as num?)?.toInt() ?? 0,
        convId: json['convId'] as String,
        nodeId: json['nodeId'] as String,
        title: json['title'] as String? ?? '(无标题)',
        content: json['content'] as String? ?? '',
        role: json['role'] as String? ?? 'USER',
        turnIndex: (json['turnIndex'] as num?)?.toInt(),
        versionIndex: (json['versionIndex'] as num?)?.toInt(),
      );
}

class StatsSummary {
  const StatsSummary({
    required this.configs,
    required this.conversations,
    required this.messages,
    required this.apiTokens,
  });

  final int configs;
  final int conversations;
  final int messages;
  final int apiTokens;

  factory StatsSummary.fromJson(Map<String, dynamic> json) => StatsSummary(
        configs: (json['configs'] as num?)?.toInt() ?? 0,
        conversations: (json['conversations'] as num?)?.toInt() ?? 0,
        messages: (json['messages'] as num?)?.toInt() ?? 0,
        apiTokens: (json['apiTokens'] as num?)?.toInt() ?? 0,
      );
}

/// 分页响应（后端 pageResponse 格式）
class Paged<T> {
  const Paged({
    required this.records,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  final List<T> records;
  final int total;
  final int page;
  final int pageSize;

  factory Paged.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJson,
  ) =>
      Paged(
        records: (json['records'] as List<dynamic>? ?? [])
            .map((e) => fromJson(e as Map<String, dynamic>))
            .toList(),
        total: (json['total'] as num?)?.toInt() ?? 0,
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
      );
}
