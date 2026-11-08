fn main() {
  let ico_path = std::env::current_dir()
    .unwrap()
    .join("icons/icon.ico");
  let ico_str = ico_path.to_string_lossy().replace('/', "\\");
  let rc_line = format!(r#"1 ICON "{}""#, ico_str.replace('\\', "\\\\"));
  let windows = tauri_build::WindowsAttributes::new().append_rc_content(rc_line);
  tauri_build::try_build(
    tauri_build::Attributes::new().windows_attributes(windows)
  ).expect("failed to run build script");
}
