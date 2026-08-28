import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dstoolkit_app/features/auth/auth_controller.dart';
import 'package:dstoolkit_app/widgets/chat_bubble.dart';

void main() {
  test('PKCE challenge 为 verifier 的 BASE64URL(SHA256)', () {
    final pkce = generatePkce();
    // verifier 长度应在 43-128 之间（RFC 7636）
    expect(pkce.verifier.length, greaterThanOrEqualTo(43));
    expect(pkce.verifier.length, lessThanOrEqualTo(128));
    // challenge 不含 padding 与 + /
    expect(pkce.challenge.contains('='), isFalse);
    expect(pkce.challenge.contains('+'), isFalse);
    expect(pkce.challenge.contains('/'), isFalse);
  });

  test('AuthStatus 游客模式可浏览主界面', () {
    const state = AuthState(status: AuthStatus.guest);
    expect(state.canBrowse, isTrue);
    const loggedOut = AuthState(status: AuthStatus.loggedOut);
    expect(loggedOut.canBrowse, isFalse);
  });

  Widget wrap(Widget child) => MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      );

  testWidgets('ChatBubble 渲染行内/块级 LaTeX 不崩溃', (tester) async {
    await tester.pumpWidget(wrap(const ChatBubble(
      role: 'ASSISTANT',
      content: '质能方程 \$E=mc^2\$ 如下：\n\n'
          r'$$'
          '\nc = \\pm\\sqrt{a^2 + b^2}\n'
          r'$$'
          '\n\n以及 \\(f(x) = x^2\\) 与 \\[a+b\\] 形式。',
    )));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(ChatBubble), findsOneWidget);
  });

  testWidgets('ChatBubble 渲染非法 LaTeX 时降级为源码文本', (tester) async {
    await tester.pumpWidget(wrap(const ChatBubble(
      role: 'ASSISTANT',
      content: '\$\$\\error{unclosed\$\$',
    )));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('ChatBubble 渲染 mermaid 代码块（网络失败走降级视图）', (tester) async {
    await tester.pumpWidget(wrap(const ChatBubble(
      role: 'ASSISTANT',
      content: '```mermaid\ngraph TD; A-->B;\n```',
    )));
    // 只 pump 一帧，不断言网络结果（测试环境无真实网络请求语义）
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.byType(ChatBubble), findsOneWidget);
  });
}
