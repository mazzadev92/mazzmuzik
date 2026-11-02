import 'package:flutter/material.dart';
import '../data/subsonic_client.dart';
import '../data/models/track.dart';
import '../data/models/album.dart';
import '../data/models/artist.dart';
import '../state/player_state.dart';
import '../state/offline_manager.dart';
import '../core/theme.dart';

class LibraryView extends StatefulWidget {
  final SubsonicClient client;
  final PlayerStateNotifier playerState;
  final OfflineManager offlineManager;

  const LibraryView({
    Key? key,
    required this.client,
    required this.playerState,
    required this.offlineManager,
  }) : super(key: key);

  @override
  State<LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends State<LibraryView> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Track> _tracks = [];
  List<Album> _albums = [];
  List<Artist> _artists = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        widget.client.getRandomSongs(size: 50),
        widget.client.getAlbumList(type: 'recent', size: 50),
        widget.client.getArtists(),
      ]);
      if (mounted) {
        setState(() {
          _tracks = results[0] as List<Track>;
          _albums = results[1] as List<Album>;
          _artists = results[2] as List<Artist>;
        });
      }
    } catch (_) {
      // Ignorer les erreurs de chargement réseau
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bibliothèque'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primaryColor,
          labelColor: AppTheme.primaryColor,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: 'Titres'),
            Tab(text: 'Albums'),
            Tab(text: 'Artistes'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTracksTab(),
                _buildAlbumsTab(),
                _buildArtistsTab(),
              ],
            ),
    );
  }

  Widget _buildTracksTab() {
    if (_tracks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.music_off, size: 64, color: AppTheme.cardColor),
            const SizedBox(height: 16),
            const Text('Aucun titre disponible', style: TextStyle(color: AppTheme.textSecondary)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadData,
              child: const Text('Actualiser'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        itemCount: _tracks.length,
        itemBuilder: (context, index) {
          final track = _tracks[index];
          return ListTile(
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.cardColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.music_note, color: AppTheme.primaryColor),
            ),
            title: Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(
              '${track.artist} • ${track.formattedDuration}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: IconButton(
              icon: const Icon(Icons.download, color: AppTheme.textSecondary),
              tooltip: 'Télécharger hors-ligne',
              onPressed: () {
                widget.offlineManager.downloadTrack(track);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Téléchargement de "${track.title}" démarré')),
                );
              },
            ),
            onTap: () {
              widget.playerState.playTracks(_tracks, index);
            },
          );
        },
      ),
    );
  }

  Widget _buildAlbumsTab() {
    if (_albums.isEmpty) {
      return const Center(child: Text('Aucun album trouvé', style: TextStyle(color: AppTheme.textSecondary)));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 0.8,
        ),
        itemCount: _albums.length,
        itemBuilder: (context, index) {
          final album = _albums[index];
          return GestureDetector(
            onTap: () => _openAlbumTracks(album),
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.surfaceColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Container(
                      decoration: const BoxDecoration(
                        color: AppTheme.cardColor,
                        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                      ),
                      child: const Center(
                        child: Icon(Icons.album, size: 64, color: AppTheme.primaryColor),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(10.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          album.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          album.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildArtistsTab() {
    if (_artists.isEmpty) {
      return const Center(child: Text('Aucun artiste trouvé', style: TextStyle(color: AppTheme.textSecondary)));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        itemCount: _artists.length,
        itemBuilder: (context, index) {
          final artist = _artists[index];
          return ListTile(
            leading: const CircleAvatar(
              backgroundColor: AppTheme.cardColor,
              child: Icon(Icons.person, color: AppTheme.primaryColor),
            ),
            title: Text(artist.name),
            subtitle: Text('${artist.albumCount} albums'),
          );
        },
      ),
    );
  }

  void _openAlbumTracks(Album album) async {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return FutureBuilder<List<Track>>(
          future: widget.client.getAlbumTracks(album.id),
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final tracks = snapshot.data!;
            return Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  height: 4,
                  width: 40,
                  decoration: BoxDecoration(
                    color: AppTheme.cardColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(album.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            Text(album.artist, style: const TextStyle(color: AppTheme.textSecondary)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.download, color: AppTheme.accentColor),
                        tooltip: 'Télécharger tout l\'album',
                        onPressed: () {
                          widget.offlineManager.downloadAlbum(album);
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Téléchargement de l\'album "${album.title}" démarré')),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const Divider(),
                Expanded(
                  child: ListView.builder(
                    itemCount: tracks.length,
                    itemBuilder: (context, idx) {
                      final t = tracks[idx];
                      return ListTile(
                        leading: Text('${idx + 1}', style: const TextStyle(color: AppTheme.textSecondary)),
                        title: Text(t.title),
                        trailing: Text(t.formattedDuration, style: const TextStyle(color: AppTheme.textSecondary)),
                        onTap: () {
                          widget.playerState.playTracks(tracks, idx);
                          Navigator.pop(context);
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
