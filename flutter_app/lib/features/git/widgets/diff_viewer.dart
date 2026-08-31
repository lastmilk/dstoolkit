// =======================================================================
// diff_viewer.dart
// Flutter 版单文件 Diff 查看器（Split / Unified），支持词级内联高亮
// =======================================================================

import 'package:flutter/material.dart';
import '../../data/models/git_types.dart';

class DiffFileViewer extends StatelessWidget {
  const DiffFileViewer({
    super.key,
    required this.file,
    this.viewMode = DiffViewMode.split,
    this.onLineTap,
  });

  final DiffFileResult file;
  final DiffViewMode viewMode;
  final void Function(DiffSide side, int lineNo, String path)? onLineTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final statusLabel = switch (file.status) {
      DiffFileStatus.added => ('新增', Colors.green[100]!, Colors.green[800]!),
      DiffFileStatus.deleted => ('删除', Colors.red[100]!, Colors.red[800]!),
      DiffFileStatus.modified => ('修改', Colors.amber[100]!, Colors.amber[900]!),
      DiffFileStatus.renamed => ('重命名', Colors.cyan[100]!, Colors.cyan[900]!),
      DiffFileStatus.copied => ('复制', Colors.blue[100]!, Colors.blue[900]!),
      DiffFileStatus.conflict => ('冲突', Colors.purple[100]!, Colors.purple[800]!),
      DiffFileStatus.unchanged => ('未变', Colors.grey[200]!, Colors.grey[600]!),
    };
    final title = switch (file.status) {
      DiffFileStatus.added => '+  ${file.newPath}',
      DiffFileStatus.deleted => '-  ${file.oldPath}',
      DiffFileStatus.renamed => '${file.oldPath} → ${file.newPath}  (相似度 ${file.similarity}%)',
      _ => file.oldPath ?? file.newPath,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: t.dividerColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            color: t.dividerColor.withOpacity(.08),
            child: Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusLabel.$2,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(statusLabel.$1,
                      style: TextStyle(
                          fontSize: 10.5,
                          color: statusLabel.$3,
                          fontWeight: FontWeight.w700,
                          letterSpacing: .3)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                        fontFamily: 'monospace', fontSize: 12.5),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text('+${file.additions}',
                    style: TextStyle(
                        color: Colors.green[700],
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Text('-${file.deletions}',
                    style: TextStyle(
                        color: Colors.red[700],
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          if (viewMode == DiffViewMode.split)
            _SplitView(file: file, onLineTap: onLineTap)
          else
            _UnifiedView(file: file, onLineTap: onLineTap),
        ],
      ),
    );
  }
}

enum DiffViewMode { split, unified }
enum DiffSide { left, right }

// =======================================================================
// Split View
// =======================================================================
class _SplitView extends StatelessWidget {
  const _SplitView({required this.file, this.onLineTap});
  final DiffFileResult file;
  final void Function(DiffSide side, int lineNo, String path)? onLineTap;

  @override
  Widget build(BuildContext context) {
    // 先把 DELETE/INSERT 组排成并排
    final rows = <_SplitRow>[];
    final dels = <DiffLine>[];
    final inss = <DiffLine>[];
    void flush() {
      while (dels.isNotEmpty || inss.isNotEmpty) {
        final d = dels.isNotEmpty ? dels.removeAt(0) : null;
        final i = inss.isNotEmpty ? inss.removeAt(0) : null;
        rows.add(_SplitRow(d, i));
      }
    }
    for (final h in file.hunks) {
      for (final ln in h.lines) {
        if (ln.op == DiffOp.EQUAL) {
          flush();
          rows.add(_SplitRow(ln, ln));
        } else if (ln.op == DiffOp.DELETE) {
          dels.add(ln);
        } else if (ln.op == DiffOp.INSERT) {
          inss.add(ln);
        }
      }
    }
    flush();

    return Column(
      children: [
        // header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          color: Colors.black.withOpacity(.03),
          child: const Row(
            children: [
              Expanded(
                  child: Text('旧版本',
                      style:
                          TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700))),
              SizedBox(width: 4),
              Expanded(
                  child: Text('新版本',
                      style: TextStyle(
                          fontSize: 10.5, fontWeight: FontWeight.w700))),
            ],
          ),
        ),
        for (var i = 0; i < rows.length; i++) _buildRow(context, rows[i]),
      ],
    );
  }

  Widget _buildRow(BuildContext context, _SplitRow row) {
    final leftLn = row.left;
    final rightLn = row.right;
    return Row(
      children: [
        _numCell(context, leftLn?.oldLineNo, leftLn?.op ?? DiffOp.EQUAL, () {
          if (leftLn?.oldLineNo != null) {
            onLineTap?.call(DiffSide.left, leftLn!.oldLineNo!, file.oldPath ?? file.newPath);
          }
        }),
        Expanded(
          child: _codeCell(
            context,
            row.left,
            row.left?.op,
            isRight: false,
          ),
        ),
        _numCell(context, rightLn?.newLineNo, rightLn?.op ?? DiffOp.EQUAL, () {
          if (rightLn?.newLineNo != null) {
            onLineTap?.call(DiffSide.right, rightLn!.newLineNo!, file.newPath);
          }
        }),
        Expanded(
          child: _codeCell(context, row.right, row.right?.op, isRight: true),
        ),
      ],
    );
  }

  Widget _numCell(BuildContext _, int? n, DiffOp op, VoidCallback onTap) {
    final bg = switch (op) {
      DiffOp.DELETE => Colors.red[100],
      DiffOp.INSERT => Colors.green[100],
      _ => Colors.black.withOpacity(.03),
    };
    final fg = switch (op) {
      DiffOp.DELETE => Colors.red[800],
      DiffOp.INSERT => Colors.green[800],
      _ => Colors.black54,
    };
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
        color: bg,
        child: Text('${n ?? ''}',
            style: TextStyle(
                fontSize: 10.5,
                color: fg,
                fontFamily: 'monospace',
                fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _codeCell(BuildContext c, DiffLine? line, DiffOp? op,
      {required bool isRight}) {
    final bg = switch (op) {
      DiffOp.DELETE => Colors.red[50],
      DiffOp.INSERT => Colors.green[50],
      _ => Colors.white,
    };
    final text = line == null
        ? ''
        : (isRight && op == DiffOp.DELETE ? ''
            : (!isRight && op == DiffOp.INSERT ? '' : line.content));
    return Container(
      color: bg,
      constraints: const BoxConstraints(minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      child: line == null
          ? const SizedBox(height: 16)
          : _inlineRich(line),
    );
  }

  static Widget _inlineRich(DiffLine ln) {
    if (ln.tokens.isEmpty) {
      return Text(ln.content,
          style: const TextStyle(
              fontFamily: 'monospace', fontSize: 12, height: 1.45));
    }
    return Text.rich(
      TextSpan(
        children: ln.tokens
            .map((t) => TextSpan(
                  text: t.text,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    height: 1.45,
                    backgroundColor: switch (t.op) {
                      DiffOp.INSERT => Colors.green[200],
                      DiffOp.DELETE => Colors.red[200],
                      _ => null,
                    },
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _SplitRow {
  final DiffLine? left;
  final DiffLine? right;
  _SplitRow(this.left, this.right);
}

// =======================================================================
// Unified View
// =======================================================================
class _UnifiedView extends StatelessWidget {
  const _UnifiedView({required this.file, this.onLineTap});
  final DiffFileResult file;
  final void Function(DiffSide side, int lineNo, String path)? onLineTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < file.hunks.length; i++) ...[
          _hunkHeader(file.hunks[i]),
          for (final ln in file.hunks[i].lines) _lineRow(context, ln),
        ],
      ],
    );
  }

  Widget _hunkHeader(DiffHunk h) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      color: Colors.blue[50],
      child: Row(
        children: [
          Text('@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@',
              style: TextStyle(
                  color: Colors.blue[800],
                  fontFamily: 'monospace',
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700)),
          if (h.sectionHeader != null)
            Padding(
              padding: const EdgeInsets.only(left: 10),
              child: Text(h.sectionHeader!,
                  style: const TextStyle(
                      color: Colors.black54, fontSize: 11.5)),
            ),
        ],
      ),
    );
  }

  Widget _lineRow(BuildContext c, DiffLine ln) {
    final bg = switch (ln.op) {
      DiffOp.INSERT => Colors.green[50],
      DiffOp.DELETE => Colors.red[50],
      _ => Colors.white,
    };
    final prefix = switch (ln.op) {
      DiffOp.INSERT => '+',
      DiffOp.DELETE => '-',
      _ => ' ',
    };
    return GestureDetector(
      onTap: () {
        if (ln.oldLineNo != null) {
          onLineTap?.call(DiffSide.left, ln.oldLineNo!, file.oldPath ?? file.newPath);
        } else if (ln.newLineNo != null) {
          onLineTap?.call(DiffSide.right, ln.newLineNo!, file.newPath);
        }
      },
      child: Container(
        color: bg,
        child: Row(
          children: [
            _num(ln.oldLineNo, ln.op, DiffOp.DELETE),
            _num(ln.newLineNo, ln.op, DiffOp.INSERT),
            Container(
              width: 18,
              alignment: Alignment.center,
              child: Text(prefix,
                  style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: ln.op == DiffOp.INSERT
                          ? Colors.green[800]
                          : ln.op == DiffOp.DELETE
                              ? Colors.red[800]
                              : Colors.black26,
                      fontWeight: FontWeight.w700)),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: _SplitView._inlineRich(ln),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _num(int? n, DiffOp lnOp, DiffOp activeWhen) {
    final isActive = lnOp == activeWhen || lnOp == DiffOp.EQUAL;
    final bg = isActive && lnOp == activeWhen
        ? (lnOp == DiffOp.INSERT ? Colors.green[100] : Colors.red[100])
        : Colors.black.withOpacity(.025);
    return Container(
      width: 34,
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      color: bg,
      child: Text('${n ?? ''}',
          style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 10.5,
              color: Colors.black54,
              fontWeight: FontWeight.w600)),
    );
  }
}
