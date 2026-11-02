import 'package:flutter/material.dart';
import '../state/offline_manager.dart';
import '../state/player_state.dart';
import '../core/theme.dart';

class OfflineView extends StatefulWidget {
  final OfflineManager offlineManager;
  final PlayerStateNotifier playerState;

  const OfflineView({
    Key? key,
    required this.offlineManager,
    required this.playerState,
  }) : super(key: key);

  @override
  State<OfflineView> createState() => _OfflineViewState();
}

class _OfflineViewState extends State<OfflineView> {
  String _cacheSizeStr = '...';

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    await widget.offlineManager.refreshCachedTracks();
    final size = await widget.offlineManager.getFormattedCacheSize();
    if (mounted) {
      setState(() {
        _cacheSizeStr = size;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.offlineManager,
      builder: (context, _) {
        final tracks = widget.offlineManager.cachedTracks;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Mode Hors-ligne'),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: _refresh,
              ),
            ],
          ),
          body: Column(
            children: [
              // Bandeau statut & Cache
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: const [
                            Icon(Icons.flight_takeoff, color: AppTheme.accentColor),
                            SizedBox(width: 12),
                            Text(
                              'Mode Avion / Hors-ligne',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        Switch(
                          value: widget.offlineManager.offlineOnlyMode,
                          activeColor: AppTheme.accentColor,
                          onChanged: (val) {
                            widget.offlineManager.setOfflineOnlyMode(val);
                          },
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Espace cache utilisé', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              _cacheSizeStr,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryColor),
                            ),
                          ],
                        ),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                          label: const Text('Vider le cache', style: TextStyle(color: Colors.redAccent)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.redAccent),
                          ),
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Vider le cache hors-ligne ?'),
                                content: const Text('Toutes les pistes téléchargées seront supprimées du stockage local.'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
                                  TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Supprimer', style: TextStyle(color: Colors.redAccent))),
                                ],
                              ),
                            );
                            if (confirm == true) {
                              await widget.offlineManager.clearAllCache();
                              await _refresh();
                            }
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Liste des morceaux hors-ligne
              Expanded(
                child: tracks.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.cloud_download, size: 64, color: AppTheme.cardColor),
                            SizedBox(height: 16),
                            Text('Aucun morceau téléchargé pour l\'écoute hors-ligne', style: TextStyle(color: AppTheme.textSecondary)),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: tracks.length,
                        itemBuilder: (context, idx) {
                          final track = tracks[idx];
                          return ListTile(
                            leading: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: AppTheme.cardColor,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.offline_pin, color: AppTheme.accentColor),
                            ),
                            title: Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${track.artist} • ${track.formattedDuration}'),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete, color: AppTheme.textSecondary),
                              onPressed: () async {
                                await widget.offlineManager.removeTrackFromCache(track.id);
                                await _refresh();
                              },
                            ),
                            onTap: () {
                              widget.playerState.playTracks(tracks, idx);
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
