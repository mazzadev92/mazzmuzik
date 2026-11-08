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
        final targetOffset = activeIndex * 48.0;
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
            backgroundColor: MazzTheme.obsidian,
            body: Center(
              child: Text(
                'Aucune lecture en cours',
                style: TextStyle(color: MazzTheme.warmStone),
              ),
            ),
          );
        }

        final pos = widget.playerState.position;
        final dur = widget.playerState.duration;
        final maxDurMs = dur.inMilliseconds > 0 ? dur.inMilliseconds.toDouble() : 1.0;
        final currentPosMs = pos.inMilliseconds.toDouble().clamp(0.0, maxDurMs);

        return Scaffold(
          backgroundColor: MazzTheme.obsidian,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.keyboard_arrow_down, size: 30, color: MazzTheme.apexWhite),
              onPressed: () => Navigator.of(context).pop(),
            ),
            centerTitle: true,
            title: Column(
              children: [
                const Text(
                  'MAZZ MUZIK',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2.5,
                    color: MazzTheme.champagne,
                  ),
                ),
                Text(
                  track.album ?? 'Engineering Tomorrow',
                  style: const TextStyle(fontSize: 11, color: MazzTheme.eucalyptus),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: Icon(
                  _showLyrics ? Icons.music_note : Icons.subtitles,
                  color: _showLyrics ? MazzTheme.champagne : MazzTheme.eucalyptus,
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
                  // Pochette Bioforge Leaf ou Paroles
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
                            letterSpacing: 0.4,
                            color: MazzTheme.apexWhite,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          track.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 15,
                            color: MazzTheme.sageGreen,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Barre de défilement (Seek Bar)
                  Column(
                    children: [
                      SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          activeTrackColor: MazzTheme.champagne,
                          inactiveTrackColor: MazzTheme.obsidianBorder,
                          thumbColor: MazzTheme.champagne,
                          overlayColor: MazzTheme.champagneGlow,
                          thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                          trackHeight: 2.5,
                        ),
                        child: Slider(
                          value: currentPosMs,
                          min: 0.0,
                          max: maxDurMs,
                          onChanged: (val) {
                            widget.playerState.seek(Duration(milliseconds: val.toInt()));
                          },
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _formatDuration(pos),
                              style: const TextStyle(fontSize: 12, color: MazzTheme.warmStone),
                            ),
                            Text(
                              _formatDuration(dur),
                              style: const TextStyle(fontSize: 12, color: MazzTheme.warmStone),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Commandes de lecture DA MAZZ
                  Expanded(
                    flex: 2,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          iconSize: 38,
                          icon: const Icon(Icons.skip_previous_rounded, color: MazzTheme.apexWhite),
                          onPressed: widget.playerState.previous,
                        ),
                        const SizedBox(width: 24),
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: MazzTheme.champagneGlow,
                                blurRadius: 20,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: IconButton(
                            iconSize: 68,
                            icon: Icon(
                              widget.playerState.isPlaying
                                  ? Icons.pause_circle_filled_rounded
                                  : Icons.play_circle_filled_rounded,
                              color: MazzTheme.champagne,
                            ),
                            onPressed: widget.playerState.playPause,
                          ),
                        ),
                        const SizedBox(width: 24),
                        IconButton(
                          iconSize: 38,
                          icon: const Icon(Icons.skip_next_rounded, color: MazzTheme.apexWhite),
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
            color: MazzTheme.obsidianSurface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: MazzTheme.obsidianBorder, width: 1.0),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.6),
                blurRadius: 30,
                offset: const Offset(0, 12),
              ),
              const BoxShadow(
                color: MazzTheme.sageGlow,
                blurRadius: 25,
                spreadRadius: 1,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Fond avec logo Bioforge Leaf
                Image.asset(
                  'assets/logo.png',
                  fit: BoxFit.contain,
                  width: 220,
                  height: 220,
                  errorBuilder: (ctx, err, stack) {
                    return const Icon(
                      Icons.spa_rounded, // Sceau végétal
                      size: 110,
                      color: MazzTheme.champagne,
                    );
                  },
                ),
              ],
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
          style: TextStyle(color: MazzTheme.warmStone, fontSize: 15),
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
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              line.text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: isActive ? 21 : 16,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
                color: isActive ? MazzTheme.champagne : MazzTheme.warmStone.withOpacity(0.4),
                letterSpacing: isActive ? 0.3 : 0.0,
              ),
            ),
          ),
        );
      },
    );
  }
}
