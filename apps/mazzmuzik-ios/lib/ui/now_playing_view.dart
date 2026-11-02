import 'package:flutter/material.dart';
import '../state/player_state.dart';
import '../core/theme.dart';

class NowPlayingView extends StatefulWidget {
  final PlayerStateNotifier playerState;

  const NowPlayingView({Key? key, required this.playerState}) : super(key: key);

  @override
  State<NowPlayingView> createState() => _NowPlayingViewState();
}

class _NowPlayingViewState extends State<NowPlayingView> {
  bool _showLyrics = false;
  final ScrollController _lyricsScrollController = ScrollController();

  @override
  void didUpdateWidget(covariant NowPlayingView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_showLyrics && widget.playerState.lyrics.isNotEmpty) {
      final activeIndex = widget.playerState.activeLyricIndex;
      if (activeIndex >= 0 && _lyricsScrollController.hasClients) {
        final targetOffset = activeIndex * 44.0;
        _lyricsScrollController.animateTo(
          targetOffset,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.playerState,
      builder: (context, _) {
        final track = widget.playerState.currentTrack;
        if (track == null) {
          return const Scaffold(
            body: Center(child: Text('Aucune lecture en cours')),
          );
        }

        final pos = widget.playerState.position;
        final dur = widget.playerState.duration;
        final maxDurMs = dur.inMilliseconds > 0 ? dur.inMilliseconds.toDouble() : 1.0;
        final currentPosMs = pos.inMilliseconds.toDouble().clamp(0.0, maxDurMs);

        return Scaffold(
          backgroundColor: AppTheme.backgroundColor,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.keyboard_arrow_down, size: 32),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: Text(
              track.album ?? 'Mazz MuZik',
              style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
            ),
            actions: [
              IconButton(
                icon: Icon(
                  _showLyrics ? Icons.music_note : Icons.subtitles,
                  color: _showLyrics ? AppTheme.accentColor : AppTheme.textSecondary,
                ),
                tooltip: 'Paroles synchronisées',
                onPressed: () {
                  setState(() {
                    _showLyrics = !_showLyrics;
                  });
                },
              ),
            ],
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Pochette ou Paroles
                  Expanded(
                    flex: 5,
                    child: _showLyrics ? _buildLyricsView() : _buildCoverArtView(track),
                  ),

                  // Titre et Artiste
                  Expanded(
                    flex: 2,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          track.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Seek bar
                  Column(
                    children: [
                      Slider(
                        value: currentPosMs,
                        min: 0.0,
                        max: maxDurMs,
                        onChanged: (val) {
                          widget.playerState.seek(Duration(milliseconds: val.toInt()));
                        },
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _formatDuration(pos),
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                            Text(
                              _formatDuration(dur),
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Commandes de lecture
                  Expanded(
                    flex: 2,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          iconSize: 42,
                          icon: const Icon(Icons.skip_previous, color: AppTheme.textPrimary),
                          onPressed: widget.playerState.previous,
                        ),
                        const SizedBox(width: 24),
                        IconButton(
                          iconSize: 72,
                          icon: Icon(
                            widget.playerState.isPlaying
                                ? Icons.pause_circle_filled
                                : Icons.play_circle_filled,
                            color: AppTheme.primaryColor,
                          ),
                          onPressed: widget.playerState.playPause,
                        ),
                        const SizedBox(width: 24),
                        IconButton(
                          iconSize: 42,
                          icon: const Icon(Icons.skip_next, color: AppTheme.textPrimary),
                          onPressed: widget.playerState.next,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCoverArtView(dynamic track) {
    return Center(
      child: AspectRatio(
        aspectRatio: 1.0,
        child: Container(
          decoration: BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.album,
              size: 140,
              color: AppTheme.cardColor,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLyricsView() {
    final lyrics = widget.playerState.lyrics;
    if (lyrics.isEmpty) {
      return const Center(
        child: Text(
          'Aucune parole synchronisée disponible',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
        ),
      );
    }

    return ListView.builder(
      controller: _lyricsScrollController,
      padding: const EdgeInsets.symmetric(vertical: 60),
      itemCount: lyrics.length,
      itemBuilder: (context, index) {
        final line = lyrics[index];
        final isActive = index == widget.playerState.activeLyricIndex;

        return GestureDetector(
          onTap: () {
            widget.playerState.seek(line.timestamp);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              line.text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: isActive ? 20 : 16,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                color: isActive ? AppTheme.accentColor : AppTheme.textSecondary.withOpacity(0.6),
              ),
            ),
          ),
        );
      },
    );
  }
}
