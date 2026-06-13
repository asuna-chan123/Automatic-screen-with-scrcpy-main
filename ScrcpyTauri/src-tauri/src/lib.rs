use std::process::Command;
use std::path::{Path, PathBuf};
use std::env;
use std::os::windows::process::CommandExt;
use std::fs;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn find_scrcpy_dir() -> PathBuf {
    let mut current_dir = env::current_exe()
        .map(|p| p.parent().unwrap_or(Path::new(".")).to_path_buf())
        .unwrap_or_else(|_| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        
    for _ in 0..6 {
        // Check if tools are right here
        if current_dir.join("adb.exe").exists() && current_dir.join("scrcpy.exe").exists() {
            return current_dir.clone();
        }
        // Check if tools are inside bundled scrcpy_tools directory
        let bundled_dir = current_dir.join("scrcpy_tools");
        if bundled_dir.join("adb.exe").exists() && bundled_dir.join("scrcpy.exe").exists() {
            return bundled_dir;
        }

        if let Some(parent) = current_dir.parent() {
            current_dir = parent.to_path_buf();
        } else {
            break;
        }
    }
    // Fallback to current working directory
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn get_appdata_dir() -> PathBuf {
    let appdata = env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let dir = PathBuf::from(appdata).join("MirrorFlux");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

#[tauri::command]
fn get_host_info() -> Result<(String, String), String> {
    let hostname = env::var("COMPUTERNAME").unwrap_or_else(|_| "My Computer".to_string());
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.connect("8.8.8.8:80").map_err(|e| e.to_string())?;
    let ip = socket.local_addr().map_err(|e| e.to_string())?.ip().to_string();
    Ok((hostname, ip))
}

#[tauri::command]
fn read_appdata(filename: &str) -> Result<String, String> {
    let path = get_appdata_dir().join(filename);
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("".to_string())
    }
}

#[tauri::command]
fn write_appdata(filename: &str, content: &str) -> Result<(), String> {
    let path = get_appdata_dir().join(filename);
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_adb_devices() -> Result<Vec<(String, String)>, String> {
    let adb_path = find_scrcpy_dir().join("adb.exe");
    if !adb_path.exists() {
        return Err("adb.exe not found".into());
    }

    let output = Command::new(&adb_path)
        .arg("devices")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() || line.starts_with("List of devices") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            devices.push((parts[0].to_string(), parts[1].to_string()));
        }
    }

    Ok(devices)
}

#[tauri::command]
fn connect_device(ip: &str, port: &str) -> Result<String, String> {
    let adb_path = find_scrcpy_dir().join("adb.exe");
    let target = format!("{}:{}", ip, port);
    
    // Disconnect first
    let _ = Command::new(&adb_path)
        .args(["disconnect", &target])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let output = Command::new(&adb_path)
        .args(["connect", &target])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout_str = String::from_utf8_lossy(&output.stdout).to_string();
    let stdout_lower = stdout_str.to_lowercase();
    if stdout_lower.contains("cannot connect") || stdout_lower.contains("failed to") {
        return Err(stdout_str);
    }

    Ok(stdout_str)
}

#[tauri::command]
fn disconnect_device(id: &str) -> Result<String, String> {
    let adb_path = find_scrcpy_dir().join("adb.exe");
    let output = Command::new(&adb_path)
        .args(["disconnect", id])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn launch_scrcpy(id: &str, turn_screen_off: bool) -> Result<(), String> {
    let scrcpy_path = find_scrcpy_dir().join("scrcpy.exe");
    if !scrcpy_path.exists() {
        return Err(format!("scrcpy.exe not found at {}", scrcpy_path.display()));
    }

    let mut cmd = Command::new(&scrcpy_path);
    cmd.args(["-s", id]);
    if turn_screen_off {
        cmd.arg("--turn-screen-off");
    }
    cmd.creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_device_ip(id: &str) -> Result<String, String> {
    let adb_path = find_scrcpy_dir().join("adb.exe");
    
    // Check tailscale IP first
    let output_addr = Command::new(&adb_path)
        .args(["-s", id, "shell", "ip", "addr"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
        
    let stdout_addr = String::from_utf8_lossy(&output_addr.stdout);
    for line in stdout_addr.lines() {
        if line.contains("inet 100.") {
            if let Some(ip_part) = line.split("inet ").nth(1) {
                if let Some(ip) = ip_part.split('/').next() {
                    return Ok(ip.split_whitespace().next().unwrap_or("").to_string());
                }
            }
        }
    }

    // Check wifi IP
    let output_route = Command::new(&adb_path)
        .args(["-s", id, "shell", "ip", "route"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
        
    let stdout_route = String::from_utf8_lossy(&output_route.stdout);
    for line in stdout_route.lines() {
        if line.contains("wlan0") && line.contains("src ") {
            if let Some(ip_part) = line.split("src ").nth(1) {
                return Ok(ip_part.split_whitespace().next().unwrap_or("").to_string());
            }
        }
    }

    Err("Could not find IP".into())
}

#[tauri::command]
fn enable_tcpip(id: &str, port: &str) -> Result<(), String> {
    let adb_path = find_scrcpy_dir().join("adb.exe");
    Command::new(&adb_path)
        .args(["-s", id, "tcpip", port])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_host_info,
            read_appdata,
            write_appdata,
            get_adb_devices,
            connect_device,
            disconnect_device,
            launch_scrcpy,
            get_device_ip,
            enable_tcpip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
