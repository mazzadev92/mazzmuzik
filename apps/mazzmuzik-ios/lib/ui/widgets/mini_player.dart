import 'package:flutter/material.dart';
import '../../state/player_state.dart';
import '../now_playing_view.dart';
import '../../core/theme.dart';

class MiniPlayer extends StatelessWidget {
  final PlayerStateNotifier playerState;

  const MiniPlayer({Key? key, required this.playerState}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final track = playerState.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final progress = (playerState.duration.inMilliseconds > 0)
        ? (playerState.position.inMilliseconds / playerState.duration.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => NowPlayingView(playerState: playerState),
          ),
        );
      },
      child: Container(
        height: 66,
        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: MazzTheme.obsidianSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: MazzTheme.obsidianBorder, width: 1.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: MazzTheme.forest,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: MazzTheme.obsidianBorder, width: 1.0),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset(
                          'assets/logo.png',
                          fit: BoxFit.cover,
                          errorBuilder: (ctx, err, stack) => const Icon(
                            Icons.spa_rounded,
                            color: MazzTheme.champagne,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            track.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: MazzTheme.apexWhite,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            track.artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: MazzTheme.sageGreen,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        playerState.isPlaying
                            ? Icons.pause_circle_filled_rounded
                            : Icons.play_circle_filled_rounded,
                        color: MazzTheme.champagne,
                        size: 38,
                      ),
                      onPressed: playerState.playPause,
                    ),
                    IconButton(
                      icon: const Icon(Icons.skip_next_rounded, color: MazzTheme.apexWhite, size: 28),
                      onPressed: playerState.next,
                    ),
                  ],
                ),
              ),
            ),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: MazzTheme.obsidianBorder,
              valueColor: const AlwaysStoppedAnimation<Color>(MazzTheme.champagne),
              minHeight: 2.0,
            ),
          ],
        ),
      ),
    );
  }
}
