import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/api_constants.dart';
import '../../data/api/line_check.dart';
import 'auth_controller.dart';

/// 登录页：App 内账号密码登录 / 注册（无需网页端）+ 游客模式入口 + 线路检测
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  bool _isRegister = false;
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  /// 线路检测结果（null = 未检测）
  List<ApiLine>? _lines;
  bool _checking = false;

  final _formKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // 进入登录页自动测速并选最快线路
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _checkLines(autoSelect: true));
  }

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkLines({bool autoSelect = false}) async {
    if (_checking) return;
    setState(() => _checking = true);
    final lines = await checkApiLines(ApiConstants.apiLines);
    if (!mounted) return;
    setState(() {
      _lines = lines;
      _checking = false;
    });
    if (autoSelect) {
      // lines 已按延迟排序，取第一个可达线路即最快
      for (final l in lines) {
        if (l.ok) {
          ref.read(selectedApiBaseProvider.notifier).state = l.baseUrl;
          break;
        }
      }
    }
  }

  void _showLineSheet() {
    final selected = ref.read(selectedApiBaseProvider);
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('选择线路',
                        style: Theme.of(context).textTheme.titleMedium),
                    Row(
                      children: [
                        if (_checking)
                          const Padding(
                            padding: EdgeInsets.only(right: 12),
                            child: SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2)),
                          ),
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded),
                          onPressed: _checking ? null : _checkLines,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              ...?_lines?.map((line) {
                final active = line.baseUrl == selected;
                return ListTile(
                  leading: Icon(
                    active
                        ? Icons.radio_button_checked_rounded
                        : Icons.radio_button_off_rounded,
                    color:
                        active ? Theme.of(context).colorScheme.primary : null,
                  ),
                  title: Text(line.label),
                  subtitle: Text(line.baseUrl),
                  trailing: _LineBadge(line: line),
                  onTap: () {
                    ref.read(selectedApiBaseProvider.notifier).state =
                        line.baseUrl;
                    setState(() => _error = null);
                    Navigator.pop(sheetCtx);
                  },
                );
              }),
              if (_lines == null && !_checking)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('未检测，点击右上角刷新')),
                ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final notifier = ref.read(authControllerProvider.notifier);
    final error = _isRegister
        ? await notifier.register(
            username: _usernameCtrl.text.trim(),
            password: _passwordCtrl.text,
          )
        : await notifier.loginWithPassword(
            username: _usernameCtrl.text.trim(),
            password: _passwordCtrl.text,
          );
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _loading = false;
        _error = error;
      });
    }
    // 成功时路由 redirect 会自动跳转
  }

  void _enterGuest() {
    ref.read(authControllerProvider.notifier).enterGuestMode();
  }

  String _selectedLabel() {
    final base = ref.watch(selectedApiBaseProvider);
    return Uri.tryParse(base)?.host ?? base;
  }

  ApiLine? _selectedLine() {
    final base = ref.watch(selectedApiBaseProvider);
    final lines = _lines;
    if (lines == null) return null;
    for (final l in lines) {
      if (l.baseUrl == base) return l;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selLine = _selectedLine();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.auto_awesome_rounded,
                      size: 56, color: theme.colorScheme.primary),
                  const SizedBox(height: 12),
                  Text(
                    'DsToolKit',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '随身查看你的 DeepSeek 对话',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 32),

                  // 登录 / 注册 切换
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('登录')),
                      ButtonSegment(value: true, label: Text('注册')),
                    ],
                    selected: {_isRegister},
                    onSelectionChanged: (s) => setState(() {
                      _isRegister = s.first;
                      _error = null;
                    }),
                  ),
                  const SizedBox(height: 20),

                  TextFormField(
                    controller: _usernameCtrl,
                    autofillHints: const [AutofillHints.username],
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: '用户名',
                      prefixIcon: const Icon(Icons.person_outline_rounded),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    validator: (v) {
                      final s = v?.trim() ?? '';
                      if (s.isEmpty) return '请输入用户名';
                      if (s.length < 2) return '用户名至少 2 位';
                      return null;
                    },
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: _obscure,
                    autofillHints: _isRegister
                        ? const [AutofillHints.newPassword]
                        : const [AutofillHints.password],
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _loading ? null : _submit(),
                    decoration: InputDecoration(
                      labelText: '密码',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    validator: (v) {
                      final s = v ?? '';
                      if (s.isEmpty) return '请输入密码';
                      if (s.length < 6) return '密码至少 6 位';
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),

                  FilledButton(
                    onPressed: _loading ? null : _submit,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            _isRegister ? '注册并登录' : '登录',
                            style: const TextStyle(fontSize: 16),
                          ),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ],

                  // ── 线路检测 ──
                  const SizedBox(height: 16),
                  InkWell(
                    onTap: _showLineSheet,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: theme.colorScheme.outlineVariant,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.speed_rounded,
                              size: 18, color: theme.colorScheme.outline),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              '线路：${_selectedLabel()}',
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium,
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (_checking)
                            const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          else if (selLine != null)
                            _LineBadge(line: selLine)
                          else
                            Text('点击检测',
                                style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.primary)),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _loading ? null : _enterGuest,
                    child: const Text('先看看 · 以游客模式进入'),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '游客模式下对话、搜索、统计不可用',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 线路延迟徽章：<150ms 绿 / <500ms 橙 / 其余红；不可达灰色
class _LineBadge extends StatelessWidget {
  const _LineBadge({required this.line});

  final ApiLine line;

  Color _color(BuildContext context) {
    if (!line.ok || line.latencyMs == null) {
      return Theme.of(context).colorScheme.outline;
    }
    if (line.latencyMs! < 150) return const Color(0xFF4CAF50);
    if (line.latencyMs! < 500) return const Color(0xFFFFA726);
    return const Color(0xFFEF5350);
  }

  @override
  Widget build(BuildContext context) {
    final text =
        (line.ok && line.latencyMs != null) ? '${line.latencyMs}ms' : '不可达';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color(context).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: _color(context),
        ),
      ),
    );
  }
}
