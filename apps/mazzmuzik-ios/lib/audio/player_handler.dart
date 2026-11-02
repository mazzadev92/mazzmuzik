import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import '../data/models/track.dart';
import '../data/local_cache.dart';
import '../data/subsonic_client.dart';

class AudioPlayerHandler extends BaseAudioHandler with QueueHandler, SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  final SubsonicClient subsonicClient;
  final LocalCacheManager cacheManager;

  List<Track> _playlist = [];
  int _currentIndex = -1;

  AudioPlayerHandler({
    required this.subsonicClient,
    required this.cacheManager,
  }) {
    _initAudioStreams();
  }

  void _initAudioStreams() {
    _player.playbackEventStream.listen((PlaybackEvent event) {
      final playing = _player.playing;
      playbackState.add(playbackState.value.copyWith(
        controls: [
          MediaControl.skipToPrevious,
          if (playing) MediaControl.pause else MediaControl.play,
          MediaControl.stop,
          MediaControl.skipToNext,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const [0, 1, 3],
        processingState: const {
          ProcessingState.idle: AudioProcessingState.idle,
          ProcessingState.loading: AudioProcessingState.loading,
          ProcessingState.buffering: AudioProcessingState.buffering,
          ProcessingState.ready: AudioProcessingState.ready,
          ProcessingState.completed: AudioProcessingState.completed,
        }[_player.processingState]!,
        playing: playing,
        updatePosition: _player.position,
        bufferedPosition: _player.bufferedPosition,
        speed: _player.speed,
        queueIndex: _currentIndex >= 0 ? _currentIndex : null,
      ));
    });

    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        skipToNext();
      }
    });
  }

  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<PlayerState> get playerStateStream => _player.playerStateStream;
  AudioPlayer get player => _player;

  Track? get currentTrack =>
      (_currentIndex >= 0 && _currentIndex < _playlist.length) ? _playlist[_currentIndex] : null;

  List<Track> get currentQueue => List.unmodifiable(_playlist);

  Future<void> playTrackList(List<Track> tracks, int startIndex) async {
    _playlist = List.from(tracks);
    _currentIndex = startIndex;

    // Convertir vers MediaItem pour audio_service
    final items = tracks.map((t) => MediaItem(
      id: t.id,
      album: t.album ?? 'Mazz MuZik',
      title: t.title,
      artist: t.artist,
      duration: Duration(seconds: t.durationSeconds),
      artUri: t.coverArtId != null ? Uri.parse(subsonicClient.buildCoverArtUrl(t.coverArtId)) : null,
    )).toList();

    queue.add(items);
    await _loadAndPlayCurrent();
  }

  Future<void> _loadAndPlayCurrent() async {
    if (_currentIndex < 0 || _currentIndex >= _playlist.length) return;
    final track = _playlist[_currentIndex];

    // Notification MediaItem
    mediaItem.add(MediaItem(
      id: track.id,
      album: track.album ?? 'Mazz MuZik',
      title: track.title,
      artist: track.artist,
      duration: Duration(seconds: track.durationSeconds),
      artUri: track.coverArtId != null ? Uri.parse(subsonicClient.buildCoverArtUrl(track.coverArtId)) : null,
    ));

    try {
      // Vérifier le cache local en priorité
      final localPath = cacheManager.getLocalAudioPath(track.id);
      if (localPath != null) {
        await _player.setFilePath(localPath);
      } else {
        final streamUrl = subsonicClient.buildStreamUrl(track.id);
        await _player.setUrl(streamUrl);
      }
      await _player.play();
    } catch (e) {
      // Passer automatiquement au suivant si la piste échoue
      skipToNext();
    }
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() async {
    await _player.stop();
    await super.stop();
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() async {
    if (_currentIndex + 1 < _playlist.length) {
      _currentIndex++;
      await _loadAndPlayCurrent();
    } else {
      await stop();
    }
  }

  @override
  Future<void> skipToPrevious() async {
    if (_player.position.inSeconds > 3) {
      // Revenir au début de la piste courante si déjà engagée
      await seek(Duration.zero);
    } else if (_currentIndex - 1 >= 0) {
      _currentIndex--;
      await _loadAndPlayCurrent();
    }
  }

  @override
  Future<void> skipToQueueItem(int index) async {
    if (index >= 0 && index < _playlist.length) {
      _currentIndex = index;
      await _loadAndPlayCurrent();
    }
  }
}
