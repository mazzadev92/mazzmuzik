import 'package:flutter/material.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF6366F1); // Indigo accent
  static const Color accentColor = Color(0xFF10B981);  // Emerald green
  static const Color backgroundColor = Color(0xFF0F172A); // Slate 900
  static const Color surfaceColor = Color(0xFF1E293B);    // Slate 800
  static const Color cardColor = Color(0xFF334155);       // Slate 700
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: backgroundColor,
      primaryColor: primaryColor,
      colorScheme: const ColorScheme.dark(
        primary: primaryColor,
        secondary: accentColor,
        surface: surfaceColor,
        background: backgroundColor,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: backgroundColor,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      cardTheme: CardTheme(
        color: surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 2,
      ),
      sliderTheme: const SliderThemeData(
        activeTrackColor: primaryColor,
        inactiveTrackColor: cardColor,
        thumbColor: primaryColor,
        overlayColor: Color(0x296366F1),
        trackHeight: 4.0,
      ),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
        titleLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
        titleMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w500),
        bodyLarge: TextStyle(color: textPrimary),
        bodyMedium: TextStyle(color: textSecondary),
      ),
    );
  }
}
