import 'package:flutter/material.dart';
import '../data/subsonic_client.dart';
import '../data/models/track.dart';
import '../data/models/album.dart';
import '../data/models/artist.dart';
import '../state/player_state.dart';
import '../state/offline_manager.dart';
import '../core/theme.dart';

class SearchView extends StatefulWidget {
  final SubsonicClient client;
  final PlayerStateNotifier playerState;
  final OfflineManager offlineManager;

  const SearchView({
    Key? key,
    required this.client,
    required this.playerState,
    required this.offlineManager,
  }) : super(key: key);

  @override
  State<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends State<SearchView> {
  final TextEditingController _controller = TextEditingController();
  List<Artist> _artists = [];
  List<Album> _albums = [];
  List<Track> _tracks = [];
  bool _isSearching = false;

  Future<void> _performSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _artists = [];
        _albums = [];
        _tracks = [];
      });
      return;
    }

    setState(() => _isSearching = true);
    try {
      final results = await widget.client.search(trimmed);
      if (mounted) {
        setState(() {
          _artists = (results['artists'] as List<Artist>?) ?? [];
          _albums = (results['albums'] as List<Album>?) ?? [];
          _tracks = (results['songs'] as List<Track>?) ?? [];
        });
      }
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          autofocus: false,
          style: const TextStyle(color: AppTheme.textPrimary),
          decoration: InputDecoration(
            hintText: 'Rechercher un artiste, album, titre...',
            hintStyle: const TextStyle(color: AppTheme.textSecondary),
            border: InputBorder.none,
            suffixIcon: _controller.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: AppTheme.textSecondary),
                    onPressed: () {
                      _controller.clear();
                      _performSearch('');
                    },
                  )
                : const Icon(Icons.search, color: AppTheme.textSecondary),
          ),
          onSubmitted: _performSearch,
        ),
      ),
      body: _isSearching
          ? const Center(child: CircularProgressIndicator())
          : (_tracks.isEmpty && _albums.isEmpty && _artists.isEmpty)
              ? Center(
                  child: Text(
                    _controller.text.isEmpty
                        ? 'Tapez un mot-clé pour lancer une recherche'
                        : 'Aucun résultat trouvé',
                    style: const TextStyle(color: AppTheme.textSecondary),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: [
                    if (_artists.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Text('Artistes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                      ),
                      ..._artists.map((a) => ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: AppTheme.cardColor,
                              child: Icon(Icons.person, color: AppTheme.primaryColor),
                            ),
                            title: Text(a.name),
                          )),
                      const Divider(),
                    ],
                    if (_albums.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Text('Albums', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                      ),
                      ..._albums.map((al) => ListTile(
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppTheme.cardColor,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Icon(Icons.album, color: AppTheme.primaryColor),
                            ),
                            title: Text(al.title),
                            subtitle: Text(al.artist),
                          )),
                      const Divider(),
                    ],
                    if (_tracks.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Text('Titres', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
                      ),
                      ..._tracks.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final t = entry.value;
                        return ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppTheme.cardColor,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(Icons.music_note, color: AppTheme.primaryColor),
                          ),
                          title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text('${t.artist} • ${t.formattedDuration}'),
                          trailing: IconButton(
                            icon: const Icon(Icons.download, color: AppTheme.textSecondary),
                            onPressed: () {
                              widget.offlineManager.downloadTrack(t);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Téléchargement de "${t.title}"')),
                              );
                            },
                          ),
                          onTap: () {
                            widget.playerState.playTracks(_tracks, idx);
                          },
                        );
                      }),
                    ],
                  ],
                ),
    );
  }
}
