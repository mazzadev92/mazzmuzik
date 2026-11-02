class LyricLine {
  final Duration timestamp;
  final String text;

  const LyricLine({required this.timestamp, required this.text});
}

class LyricsParser {
  static final RegExp _lrcRegex = RegExp(r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)');

  static List<LyricLine> parse(String? lrc) {
    if (lrc == null || lrc.trim().isEmpty) return [];
    final List<LyricLine> lines = [];

    for (final rawLine in lrc.split('\n')) {
      final line = rawLine.trim();
      final match = _lrcRegex.firstMatch(line);
      if (match != null) {
        final minutes = int.parse(match.group(1)!);
        final seconds = int.parse(match.group(2)!);
        final fractionStr = match.group(3)!;
        final millis = fractionStr.length == 2
            ? int.parse(fractionStr) * 10
            : int.parse(fractionStr);
        final text = match.group(4)!.trim();

        lines.add(LyricLine(
          timestamp: Duration(minutes: minutes, seconds: seconds, milliseconds: millis),
          text: text,
        ));
      }
    }

    lines.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    return lines;
  }

  static int findActiveIndex(List<LyricLine> lines, Duration currentPosition) {
    if (lines.isEmpty) return -1;
    for (int i = lines.length - 1; i >= 0; i--) {
      if (currentPosition >= lines[i].timestamp) {
        return i;
      }
    }
    return 0;
  }
}
