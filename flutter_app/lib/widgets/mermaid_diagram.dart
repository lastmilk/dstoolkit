import 'dart:convert';

import 'package:flutter/material.dart';

/// Mermaid 图表渲染：源码经 mermaid.ink 服务渲染为 PNG 图片。
/// 加载失败（网络/语法错误）时显示源码 + 重试按钮，不阻塞阅读。
class MermaidDiagram extends StatefulWidget {
  const MermaidDiagram({super.key, required this.code});

  final String code;

  @override
  State<MermaidDiagram> createState() => _MermaidDiagramState();
}

class _MermaidDiagramState extends State<MermaidDiagram> {
  int _attempt = 0;

  String _buildUrl(Brightness brightness) {
    final b64 = base64Url.encode(utf8.encode(widget.code));
    final theme = brightness == Brightness.dark ? 'dark' : 'default';
    return 'https://mermaid.ink/img/$b64?type=png&width=900&theme=$theme';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Image.network(
        _buildUrl(theme.brightness),
        key: ValueKey(_attempt),
        width: double.infinity,
        fit: BoxFit.scaleDown,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(
            height: 140,
            child: Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                value: progress.expectedTotalBytes != null
                    ? progress.cumulativeBytesLoaded /
                        progress.expectedTotalBytes!
                    : null,
              ),
            ),
          );
        },
        errorBuilder: (_, __, ___) => _MermaidErrorView(
          code: widget.code,
          onRetry: () => setState(() => _attempt++),
        ),
      ),
    );
  }
}

/// 失败视图：提示 + 重试 + 可查看源码
class _MermaidErrorView extends StatelessWidget {
  const _MermaidErrorView({required this.code, required this.onRetry});

  final String code;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.image_not_supported_outlined,
                size: 16, color: theme.colorScheme.outline),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '图表渲染失败（网络问题或语法错误）',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('重试'),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
              ),
            ),
          ],
        ),
        SelectableText(
          code,
          style: theme.textTheme.bodySmall?.copyWith(fontFamily: 'monospace'),
        ),
      ],
    );
  }
}
