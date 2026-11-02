import 'dart:convert';
import 'package:crypto/crypto.dart';

class SecurityUtils {
  /// Génère un sel aléatoire hexadécimal pour l'authentification Subsonic
  static String generateSalt([int length = 8]) {
    final now = DateTime.now().microsecondsSinceEpoch.toString();
    final bytes = utf8.encode(now);
    final digest = md5.convert(bytes);
    return digest.toString().substring(0, length);
  }

  /// Calcule le token Subsonic md5(password + salt)
  static String computeSubsonicToken(String password, String salt) {
    final combined = utf8.encode(password + salt);
    return md5.convert(combined).toString();
  }
}
