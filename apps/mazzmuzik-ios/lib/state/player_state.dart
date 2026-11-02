import 'dart:async';
import 'package:flutter/foundation.dart';
import '../audio/player_handler.dart';
import '../audio/lyrics_parser.dart';
import '../data/models/track.dart';

class PlayerStateNotifier extends ChangeNotifier {
  final AudioPlayerHandler audioHandler;

  Track? _currentTrack;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isPlaying = false;
  List<LyricLine> _lyrics = [];
  int _activeLyricIndex = -1;

  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _stateSub;
  StreamSubscription? _mediaSub;

  PlayerStateNotifier({required this.audioHandler}) {
    _posSub = audioHandler.positionStream.listen((pos) {
      _position = pos;
      if (_lyrics.isNotEmpty) {
        final idx = LyricsParser.findActiveIndex(_lyrics, pos);
        if (idx != _activeLyricIndex) {
          _activeLyricIndex = idx;
        }
      }
      notifyListeners();
    });

    _durSub = audioHandler.durationStream.listen((dur) {
      if (dur != null) {
        _duration = dur;
        notifyListeners();
      }
    });

    _stateSub = audioHandler.playerStateStream.listen((state) {
      _isPlaying = state.playing;
      notifyListeners();
    });

    _mediaSub = audioHandler.mediaItem.listen((item) async {
      _currentTrack = audioHandler.currentTrack;
      if (_currentTrack != null) {
        await _loadLyricsForTrack(_currentTrack!);
      }
      notifyListeners();
    });
  }

  Track? get currentTrack => _currentTrack;
  Duration get position => _position;
  Duration get duration => _duration;
  bool get isPlaying => _isPlaying;
  List<LyricLine> get lyrics => _lyrics;
  int get activeLyricIndex => _activeLyricIndex;

  Future<void> _loadLyricsForTrack(Track track) async {
    _lyrics = [];
    _activeLyricIndex = -1;

    // 1. Regarder dans le cache local
    final localLrc = await audioHandler.cacheManager.getLocalLyrics(track.id);
    if (localLrc != null && localLrc.isNotEmpty) {
      _lyrics = LyricsParser.parse(localLrc);
      notifyListeners();
      return;
    }

    // 2. Récupérer depuis le serveur Subsonic
    final serverLrc = await audioHandler.subsonicClient.getLyrics(track.artist, track.title);
    if (serverLrc != null && serverLrc.isNotEmpty) {
      await audioHandler.cacheManager.saveTrackLyrics(track.id, serverLrc);
      _lyrics = LyricsParser.parse(serverLrc);
      notifyListeners();
    }
  }

  void playPause() {
    if (_isPlaying) {
      audioHandler.pause();
    } else {
      audioHandler.play();
    }
  }

  void seek(Duration pos) {
    audioHandler.seek(pos);
  }

  void next() {
    audioHandler.skipToNext();
  }

  void previous() {
    audioHandler.skipToPrevious();
  }

  void playTracks(List<Track> tracks, int startIndex) {
    audioHandler.playTrackList(tracks, startIndex);
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _mediaSub?.cancel();
    super.dispose();
  }
}
