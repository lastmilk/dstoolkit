// =======================================================================
// commit_graph_painter.dart
// 简化的提交DAG图 CustomPainter（移动端适配版）
// 绘制多彩分支轨迹 + 每个commit圆点
// =======================================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../data/models/git_types.dart';

class CommitGraphInfo {
  final List<({GitCommitEntity commit, int lane, List<({int pid, int pLane})> parents})> rows;
  final int laneCount;
  const CommitGraphInfo(this.rows, this.laneCount);
}

CommitGraphInfo computeLayout(List<GitCommitEntity> commits) {
  final laneMap = <int, int>{}; // commitId -> lane
  final freeLanes = <int>[];
  var nextLane = 0;
  final result = <({GitCommitEntity commit, int lane, List<({int pid, int pLane})> parents})>[];

  for (final c in commits) {
    int lane;
    if (laneMap.containsKey(c.id)) {
      lane = laneMap[c.id]!;
    } else {
      lane = freeLanes.isNotEmpty ? freeLanes.removeAt(0) : nextLane++;
      laneMap[c.id] = lane;
    }
    final parents = <({int pid, int pLane})>[];
    // 排序: parentOrder
    final links = [...c.parentLinks]..sort((a, b) => a.parentOrder - b.parentOrder);
    for (var i = 0; i < links.length; i++) {
      final p = links[i];
      final pid = p.parentId;
      final pLane = laneMap[pid] ?? (i == 0 ? lane : (freeLanes.isNotEmpty ? freeLanes.removeAt(0) : nextLane++));
      laneMap[pid] = pLane;
      parents.add((pid: pid, pLane: pLane));
    }
    result.add((commit: c, lane: lane, parents: parents));
  }
  final maxLane = laneMap.values.fold<int>(-1, (m, v) => math.max(m, v));
  return CommitGraphInfo(result, maxLane + 1);
}

class CommitGraphPainter extends CustomPainter {
  final CommitGraphInfo info;
  final double laneWidth;
  final double rowHeight;
  final double nodeSize;

  CommitGraphPainter({
    required this.info,
    this.laneWidth = 18,
    this.rowHeight = 44,
    this.nodeSize = 10,
  });

  static const _colors = [
    Color(0xFF3B82F6), Color(0xFF10B981), Color(0xFFF59E0B), Color(0xFFEF4444),
    Color(0xFF8B5CF6), Color(0xFFEC4899), Color(0xFF06B6D4), Color(0xFF84CC16),
    Color(0xFFF97316), Color(0xFF6366F1), Color(0xFF14B8A6), Color(0xFFE11D48),
  ];

  Color colorFor(int lane) => _colors[lane % _colors.length];

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final nodePaint = Paint()..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = Colors.white;
    const padLeft = 8.0;

    // 先画边（每一行连向parent）
    for (var i = 0; i < info.rows.length; i++) {
      final row = info.rows[i];
      final x1 = padLeft + row.lane * laneWidth + laneWidth / 2;
      final y1 = i * rowHeight + rowHeight / 2;
      for (final p in row.parents) {
        // 找到 parent 的行索引
        final pIdx = info.rows.indexWhere((r) => r.commit.id == p.pid);
        if (pIdx < 0) continue;
        final x2 = padLeft + p.pLane * laneWidth + laneWidth / 2;
        final y2 = pIdx * rowHeight + rowHeight / 2;
        linePaint.color = colorFor(math.max(row.lane, p.pLane)).withOpacity(.8);
        if (row.lane == p.pLane) {
          canvas.drawLine(Offset(x1, y1), Offset(x2, y2), linePaint);
        } else {
          final path = Path()
            ..moveTo(x1, y1)
            ..cubicTo(x1, y1 + (y2 - y1) / 2, x2, y2 - (y2 - y1) / 2, x2, y2);
          canvas.drawPath(path, linePaint);
        }
      }
    }
    // 再画节点
    for (var i = 0; i < info.rows.length; i++) {
      final row = info.rows[i];
      final cx = padLeft + row.lane * laneWidth + laneWidth / 2;
      final cy = i * rowHeight + rowHeight / 2;
      final r = row.commit.isMerge ? nodeSize * 0.65 : nodeSize * 0.55;
      nodePaint.color = colorFor(row.lane);
      canvas.drawCircle(Offset(cx, cy), r, nodePaint);
      canvas.drawCircle(Offset(cx, cy), r, strokePaint);
    }
  }

  @override
  bool shouldRepaint(covariant CommitGraphPainter oldDelegate) =>
      oldDelegate.info != info;
}
