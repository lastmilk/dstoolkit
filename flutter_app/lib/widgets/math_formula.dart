import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

/// LaTeX 公式渲染（flutter_math_fork，纯 Dart 无 WebView）。
/// 解析/构建失败时降级为源码文本（红字 monospace），绝不崩溃。
class MathFormula extends StatelessWidget {
  const MathFormula({super.key, required this.tex, this.display = false});

  final String tex;

  /// display=true：独立公式块（居中、可横向滚动、稍大字号）
  final bool display;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = theme.textTheme.bodyMedium?.copyWith(
      fontSize: display ? 17 : 15,
      height: 1.6,
    );

    final math = Math.tex(
      tex,
      mathStyle: display ? MathStyle.display : MathStyle.text,
      textStyle: style,
      onErrorFallback: (_) => Text(
        tex,
        style: style?.copyWith(
          fontFamily: 'monospace',
          color: theme.colorScheme.error,
        ),
      ),
    );

    if (!display) return math;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: math,
    );
  }
}
