import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../data/subsonic_client.dart';
import '../data/local_cache.dart';
import '../core/theme.dart';

class SettingsView extends StatefulWidget {
  final SubsonicClient client;
  final LocalCacheManager cacheManager;

  const SettingsView({
    Key? key,
    required this.client,
    required this.cacheManager,
  }) : super(key: key);

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  final _urlController = TextEditingController();
  final _userController = TextEditingController();
  final _passController = TextEditingController();

  bool? _pingSuccess;
  bool _testing = false;
  double _cacheLimitGb = 10.0;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _urlController.text = prefs.getString('server_url') ?? widget.client.serverUrl;
    _userController.text = prefs.getString('username') ?? widget.client.username;
    _passController.text = prefs.getString('password') ?? widget.client.password;
    final bytes = widget.cacheManager.maxCacheSizeBytes;
    setState(() {
      _cacheLimitGb = bytes / (1024 * 1024 * 1024);
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', _urlController.text.trim());
    await prefs.setString('username', _userController.text.trim());
    await prefs.setString('password', _passController.text);

    widget.client.serverUrl = _urlController.text.trim();
    widget.client.username = _userController.text.trim();
    widget.client.password = _passController.text;

    final bytes = (_cacheLimitGb * 1024 * 1024 * 1024).toInt();
    await widget.cacheManager.setMaxCacheSizeBytes(bytes);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paramètres enregistrés')),
      );
    }
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _pingSuccess = null;
    });

    widget.client.serverUrl = _urlController.text.trim();
    widget.client.username = _userController.text.trim();
    widget.client.password = _passController.text;

    final ok = await widget.client.ping();
    if (mounted) {
      setState(() {
        _testing = false;
        _pingSuccess = ok;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Réglages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.check),
            tooltip: 'Enregistrer',
            onPressed: _saveSettings,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Section Serveur
          const Text(
            'SERVEUR MAZZ MUZIK',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    controller: _urlController,
                    decoration: const InputDecoration(
                      labelText: 'URL du serveur (LAN ou WireGuard)',
                      hintText: 'http://192.168.1.50:4040 ou http://10.7.0.1:4040',
                      prefixIcon: Icon(Icons.dns),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _userController,
                    decoration: const InputDecoration(
                      labelText: 'Nom d\'utilisateur',
                      prefixIcon: Icon(Icons.person),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Mot de passe',
                      prefixIcon: Icon(Icons.lock),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      ElevatedButton.icon(
                        icon: _testing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.electrical_services),
                        label: const Text('Tester la connexion'),
                        onPressed: _testing ? null : _testConnection,
                      ),
                      if (_pingSuccess != null)
                        Chip(
                          avatar: Icon(
                            _pingSuccess! ? Icons.check_circle : Icons.error,
                            color: _pingSuccess! ? AppTheme.accentColor : Colors.redAccent,
                            size: 18,
                          ),
                          label: Text(_pingSuccess! ? 'Connecté' : 'Échec'),
                          backgroundColor: AppTheme.cardColor,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Section Cache & Stockage
          const Text(
            'STOCKAGE & CACHE LRU',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Plafond du cache local'),
                      Text(
                        '${_cacheLimitGb.toStringAsFixed(0)} Go',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                      ),
                    ],
                  ),
                  Slider(
                    value: _cacheLimitGb,
                    min: 1.0,
                    max: 50.0,
                    divisions: 49,
                    onChanged: (val) {
                      setState(() {
                        _cacheLimitGb = val;
                      });
                    },
                  ),
                  const Text(
                    'Au-delà du plafond, les morceaux les moins récemment écoutés sont automatiquement purgés (algorithme LRU).',
                    style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Section Réseau WireGuard
          const Text(
            'ACCÈS DISTANT (WIREGUARD)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: const [
                  Icon(Icons.vpn_key, color: AppTheme.accentColor, size: 32),
                  SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'Pour écouter hors du domicile sans ouvrir de port public, activez le tunnel WireGuard mazz0 sur votre iPhone.',
                      style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Charte & Licence
          Center(
            child: Column(
              children: const [
                Text(
                  'Mazz MuZik • v0.1.0',
                  style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 4),
                Text(
                  'Écosystème musical personnel sous licence GPL-3.0\nZéro télémétrie • Zéro compte tiers',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
