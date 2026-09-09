use serde::Deserialize;
use std::{fs, path::{Component, Path, PathBuf}};
#[derive(Deserialize)]
struct ExportFile { path: String, data: Vec<u8> }
fn safe_relative(path: &str) -> Result<PathBuf, String> {
    let relative = PathBuf::from(path);
    if relative.as_os_str().is_empty() || relative.components().any(|c| !matches!(c, Component::Normal(_))) || path.contains('\\') || path.contains(':') {
        return Err("Invalid relative file path.".into());
    }
    Ok(relative)
}
#[tauri::command]
fn read_sidecar(asset_path: String, relative: String) -> Result<Vec<u8>, String> {
    if !asset_path.to_ascii_lowercase().ends_with(".gltf") { return Err("Sidecars require a GLTF document.".into()); }
    let parent = Path::new(&asset_path).parent().ok_or("Invalid asset path.")?.canonicalize().map_err(|e|e.to_string())?;
    let path = parent.join(safe_relative(&relative)?).canonicalize().map_err(|e|format!("Missing resource {relative}: {e}"))?;
    if !path.starts_with(&parent) {return Err("Resource is outside the asset folder.".into());}
    fs::read(path).map_err(|e|format!("Cannot read resource: {e}"))
}
#[tauri::command]
fn export_files(directory: String, name: String, files: Vec<ExportFile>) -> Result<String, String> {
    if name.is_empty() || !name.chars().all(|c|c.is_ascii_alphanumeric() || c=='_' || c=='-') {return Err("Invalid asset name.".into());}
    let parent=Path::new(&directory);
    if !parent.is_dir() {return Err("Output directory does not exist.".into());}
    for file in &files {safe_relative(&file.path)?;}
    let mut selected=None;
    for index in 0..10000 {
        let candidate=parent.join(if index==0 {name.clone()}else{format!("{name}_{index:03}")});
        match fs::create_dir(&candidate) {Ok(_)=>{selected=Some(candidate);break;},Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>continue,Err(e)=>return Err(format!("Cannot create output directory: {e}"))}
    }
    let output=selected.ok_or("Too many exports with the same name.")?;
    let result=(||->Result<(),String>{for file in files {let path=output.join(safe_relative(&file.path)?);if let Some(parent)=path.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?;}fs::write(path,file.data).map_err(|e|format!("Cannot write export: {e}"))?;}Ok(())})();
    if let Err(error)=result { let _=fs::remove_dir_all(&output);return Err(error); }
    Ok(output.to_string_lossy().into_owned())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![export_files, read_sidecar])
        .run(tauri::generate_context!()).expect("Error launching SpriteForge");
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn reject_traversal() {for p in ["../evil", "/etc/passwd", "C:\\file", "a/../../file", ""] {assert!(safe_relative(p).is_err());}assert!(safe_relative("frames/item.png").is_ok());}
    #[test] fn export_never_overwrites() {let root=std::env::temp_dir().join(format!("spriteforge-test-{}",std::process::id()));fs::create_dir_all(&root).unwrap();let a=export_files(root.to_string_lossy().into(),"Asset".into(),vec![ExportFile{path:"a.txt".into(),data:vec![42]}]).unwrap();let b=export_files(root.to_string_lossy().into(),"Asset".into(),vec![]).unwrap();assert_ne!(a,b);assert_eq!(fs::read(Path::new(&a).join("a.txt")).unwrap(),vec![42]);fs::remove_dir_all(root).unwrap();}
}
