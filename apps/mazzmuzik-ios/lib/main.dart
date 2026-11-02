import 'package:flutter/material.dart';
import 'package:audio_service/audio_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme.dart';
import 'core/constants.dart';
import 'data/subsonic_client.dart';
import 'data/local_cache.dart';
import 'audio/player_handler.dart';
import 'state/player_state.dart';
import 'state/offline_manager.dart';

import 'ui/library_view.dart';
import 'ui/search_view.dart';
import 'ui/offline_view.dart';
import 'ui/settings_view.dart';
import 'ui/widgets/mini_player.dart';

late AudioPlayerHandler _audioHandler;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  final serverUrl = prefs.getString('server_url') ?? AppConstants.defaultServerUrl;
  final username = prefs.getString('username') ?? '';
  final password = prefs.getString('password') ?? '';

  final client = SubsonicClient(
    serverUrl: serverUrl,
    username: username,
    password: password,
  );

  final cache = LocalCacheManager();
  await cache.init();

  _audioHandler = await AudioService.init(
    builder: () => AudioPlayerHandler(
      subsonicClient: client,
      cacheManager: cache,
    ),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'fun.mazzmuzik.channel.audio',
      androidNotificationChannelName: 'Mazz MuZik Audio Playback',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
    ),
  );

  runApp(MazzMuzikApp(
    client: client,
    cacheManager: cache,
    audioHandler: _audioHandler,
  ));
}

class MazzMuzikApp extends StatelessWidget {
  final SubsonicClient client;
  final LocalCacheManager cacheManager;
  final AudioPlayerHandler audioHandler;

  const MazzMuzikApp({
    Key? key,
    required this.client,
    required this.cacheManager,
    required this.audioHandler,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: MainShell(
        client: client,
        cacheManager: cacheManager,
        audioHandler: audioHandler,
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  final SubsonicClient client;
  final LocalCacheManager cacheManager;
  final AudioPlayerHandler audioHandler;

  const MainShell({
    Key? key,
    required this.client,
    required this.cacheManager,
    required this.audioHandler,
  }) : super(key: key);

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  late PlayerStateNotifier _playerState;
  late OfflineManager _offlineManager;

  @override
  void initState() {
    super.initState();
    _playerState = PlayerStateNotifier(audioHandler: widget.audioHandler);
    _offlineManager = OfflineManager(
      cacheManager: widget.cacheManager,
      subsonicClient: widget.client,
    );
  }

  @override
  void dispose() {
    _playerState.dispose();
    _offlineManager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      LibraryView(
        client: widget.client,
        playerState: _playerState,
        offlineManager: _offlineManager,
      ),
      SearchView(
        client: widget.client,
        playerState: _playerState,
        offlineManager: _offlineManager,
      ),
      OfflineView(
        offlineManager: _offlineManager,
        playerState: _playerState,
      ),
      SettingsView(
        client: widget.client,
        cacheManager: widget.cacheManager,
      ),
    ];

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: pages,
          ),
          AnimatedBuilder(
            animation: _playerState,
            builder: (context, _) {
              if (_playerState.currentTrack == null) {
                return const SizedBox.shrink();
              }
              return Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SafeArea(
                  child: MiniPlayer(playerState: _playerState),
                ),
              );
            },
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.library_music),
            label: 'Bibliothèque',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Recherche',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.offline_pin),
            label: 'Hors-ligne',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Réglages',
          ),
        ],
      ),
    );
  }
}
