import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../data/local_cache.dart';
import '../data/subsonic_client.dart';
import '../data/models/track.dart';
import '../data/models/album.dart';

class OfflineManager extends ChangeNotifier {
  final LocalCacheManager cacheManager;
  final SubsonicClient subsonicClient;

  List<Track> _cachedTracks = [];
  bool _isLoading = false;
  bool _offlineOnlyMode = false;
  final Map<String, double> _downloadProgress = {};

  OfflineManager({
    required this.cacheManager,
    required this.subsonicClient,
  });

  List<Track> get cachedTracks => List.unmodifiable(_cachedTracks);
  bool get isLoading => _isLoading;
  bool get offlineOnlyMode => _offlineOnlyMode;
  Map<String, double> get downloadProgress => Map.unmodifiable(_downloadProgress);

  void setOfflineOnlyMode(bool value) {
    _offlineOnlyMode = value;
    notifyListeners();
  }

  Future<void> refreshCachedTracks() async {
    _isLoading = true;
    notifyListeners();
    try {
      _cachedTracks = await cacheManager.getAllCachedTracks();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> downloadTrack(Track track) async {
    if (await cacheManager.isCached(track.id)) return;

    _downloadProgress[track.id] = 0.05;
    notifyListeners();

    try {
      final streamUrl = subsonicClient.buildStreamUrl(track.id);
      final req = http.Request('GET', Uri.parse(streamUrl));
      final res = await req.send();

      if (res.statusCode == 200) {
        final totalBytes = res.contentLength ?? 0;
        int receivedBytes = 0;
        final List<int> bytes = [];

        await for (final chunk in res.stream) {
          bytes.addAll(chunk);
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            _downloadProgress[track.id] = (receivedBytes / totalBytes).clamp(0.0, 1.0);
            notifyListeners();
          }
        }

        final ext = track.suffix ?? 'opus';
        await cacheManager.saveTrackAudio(track.id, bytes, ext, track);

        // Télécharger également les paroles synchronisées si disponibles
        final lrc = await subsonicClient.getLyrics(track.artist, track.title);
        if (lrc != null && lrc.isNotEmpty) {
          await cacheManager.saveTrackLyrics(track.id, lrc);
        }
      }
    } catch (_) {
      // Ignorer ou marquer en erreur
    } finally {
      _downloadProgress.remove(track.id);
      await refreshCachedTracks();
    }
  }

  Future<void> downloadAlbum(Album album) async {
    final tracks = await subsonicClient.getAlbumTracks(album.id);
    for (final track in tracks) {
      await downloadTrack(track);
    }
  }

  Future<void> removeTrackFromCache(String trackId) async {
    await cacheManager.removeTrack(trackId);
    await refreshCachedTracks();
  }

  Future<void> clearAllCache() async {
    await cacheManager.clearCache();
    await refreshCachedTracks();
  }

  Future<String> getFormattedCacheSize() async {
    final bytes = await cacheManager.getCacheSizeBytes();
    return cacheManager.formatBytes(bytes);
  }
}
