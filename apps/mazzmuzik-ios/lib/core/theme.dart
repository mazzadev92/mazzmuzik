import 'package:flutter/material.dart';

/// MAZZ MUZIK - DESIGN SYSTEM OFFICIEL (Extrait de D:\Mazz Laef)
/// DA MAZZ : Palette Bioforge Leaf, zéro blanc pur, zéro rouge vif, bordures 1px hairline.
class MazzTheme {
  // Brand Guide Palette officielle
  static const Color obsidian = Color(0xFF090D0A);        // Fond principal noir-vert obsidienne
  static const Color obsidianSurface = Color(0xFF121714); // Surfaces cartes et modales
  static const Color obsidianBorder = Color(0xFF1D2A22);  // Bordure hairline 1px
  static const Color forest = Color(0xFF123C2C);          // Ombre chloroplaste profonde
  static const Color livingGreen = Color(0xFF2F674A);     // Accent actif
  
  static const Color sageGreen = Color(0xFF94B89A);       // Renouveau, équilibre, titres
  static const Color eucalyptus = Color(0xFF6B8F7A);      // Clarté, sous-titres, innovation
  static const Color warmStone = Color(0xFFD8CAB7);       // Humanité, texte secondaire doux
  static const Color champagne = Color(0xFFC9A57A);       // Précision, boutons premium, curseurs
  static const Color copper = Color(0xFFA87D54);          // Erreurs / alertes douces (jamais de rouge)
  static const Color apexWhite = Color(0xFFF4F1EA);       // Blanc chaud luminescent (jamais #FFFFFF)

  // Lueur Bioforge Leaf
  static const Color champagneGlow = Color(0x73C9A57A);
  static const Color sageGlow = Color(0x5994B89A);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: obsidian,
      primaryColor: champagne,
      colorScheme: const ColorScheme.dark(
        primary: champagne,
        secondary: sageGreen,
        surface: obsidianSurface,
        background: obsidian,
        error: copper,
        onPrimary: obsidian,
        onSecondary: obsidian,
        onSurface: apexWhite,
        onBackground: apexWhite,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: obsidian,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: apexWhite,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: obsidianSurface,
        selectedItemColor: champagne,
        unselectedItemColor: eucalyptus,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      cardTheme: CardTheme(
        color: obsidianSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: obsidianBorder, width: 1.0),
        ),
        elevation: 0,
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: champagne,
        inactiveTrackColor: obsidianBorder,
        thumbColor: champagne,
        overlayColor: Color(0x29C9A57A),
        trackHeight: 3.0,
      ),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(color: apexWhite, fontWeight: FontWeight.w700),
        titleLarge: TextStyle(color: apexWhite, fontWeight: FontWeight.w600),
        titleMedium: TextStyle(color: sageGreen, fontWeight: FontWeight.w500),
        bodyLarge: TextStyle(color: apexWhite),
        bodyMedium: TextStyle(color: warmStone),
      ),
    );
  }
}

// Alias de rétrocompatibilité
typedef AppTheme = MazzTheme;
