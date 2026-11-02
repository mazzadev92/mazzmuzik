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
        height: 64,
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppTheme.cardColor,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.music_note, color: AppTheme.primaryColor),
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
                              color: AppTheme.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            track.artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        playerState.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                        color: AppTheme.primaryColor,
                        size: 36,
                      ),
                      onPressed: playerState.playPause,
                    ),
                    IconButton(
                      icon: const Icon(Icons.skip_next, color: AppTheme.textPrimary),
                      onPressed: playerState.next,
                    ),
                  ],
                ),
              ),
            ),
            LinearProgressIndicator(
              value: progress,
              backgroundColor: AppTheme.cardColor,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
              minHeight: 2,
            ),
          ],
        ),
      ),
    );
  }
}
