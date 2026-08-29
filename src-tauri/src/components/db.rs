use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rusqlite::{params, Connection};



 /*$$$$$$              /$$               /$$$$$$$
| $$__  $$            | $$              | $$__  $$
| $$  \ $$  /$$$$$$  /$$$$$$    /$$$$$$ | $$  \ $$  /$$$$$$   /$$$$$$$  /$$$$$$
| $$  | $$ |____  $$|_  $$_/   |____  $$| $$$$$$$  |____  $$ /$$_____/ /$$__  $$
| $$  | $$  /$$$$$$$  | $$      /$$$$$$$| $$__  $$  /$$$$$$$|  $$$$$$ | $$$$$$$$
| $$  | $$ /$$__  $$  | $$ /$$ /$$__  $$| $$  \ $$ /$$__  $$ \____  $$| $$_____/
| $$$$$$$/|  $$$$$$$  |  $$$$/|  $$$$$$$| $$$$$$$/|  $$$$$$$ /$$$$$$$/|  $$$$$$$
|_______/  \_______/   \___/   \_______/|_______/  \_______/|_______/  \______*/

#[derive(Serialize, Deserialize)]
pub struct MetadataItem {
    pub caption: Option<String>,
    pub labels: Option<Vec<String>>,
    pub text: Option<Vec<String>>,
    pub embedding: Option<Vec<f32>>,
}

#[tauri::command]
pub fn read_metadata_db(db_path: String) -> Result<HashMap<String, MetadataItem>, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT name, caption, labels, text, embedding FROM items")
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let caption: Option<String> = row.get(1)?;
            let labels_raw: Option<String> = row.get(2)?;
            let text_raw: Option<String> = row.get(3)?;
            let embedding_bytes: Option<Vec<u8>> = row.get(4)?;

            Ok((name, caption, labels_raw, text_raw, embedding_bytes))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        let (name, caption, labels_raw, text_raw, embedding_bytes) = row.map_err(|e| e.to_string())?;

        let labels = labels_raw.and_then(|json| serde_json::from_str(&json).ok());
        let text = text_raw.and_then(|json| serde_json::from_str(&json).ok());

        let embedding = embedding_bytes.map(|bytes: Vec<u8>| {
            bytes
                .chunks_exact(4)
                .map(|chunk: &[u8]| f32::from_le_bytes(chunk.try_into().unwrap()))
                .collect()
        });

        map.insert(name, MetadataItem { caption, labels, text, embedding });
    }

    Ok(map)
}

#[tauri::command]
pub fn save_metadata_db(db_path: String, updated: HashMap<String, MetadataItem>, deleted: Vec<String>) -> Result<(), String> {
    let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "CREATE TABLE IF NOT EXISTS items (name TEXT PRIMARY KEY NOT NULL, caption TEXT, labels TEXT, text TEXT, embedding BLOB)",
        [],
    ).map_err(|e| e.to_string())?;

    {
        let mut upsert_stmt = tx
            .prepare(
                "INSERT INTO items (name, caption, labels, text, embedding)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(name) DO UPDATE SET
                     caption = excluded.caption,
                     labels = excluded.labels,
                     text = excluded.text,
                     embedding = excluded.embedding",
            )
            .map_err(|e| e.to_string())?;

        for (name, item) in updated {
            let labels_json = item.labels.map(|l| serde_json::to_string(&l).unwrap_or_default());
            let text_json = item.text.map(|t| serde_json::to_string(&t).unwrap_or_default());

            let embedding_bytes: Option<Vec<u8>> = item.embedding.map(|vec| {
                vec.iter().flat_map(|val| val.to_le_bytes()).collect()
            });

            upsert_stmt
                .execute(params![name, item.caption, labels_json, text_json, embedding_bytes])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut delete_stmt = tx.prepare("DELETE FROM items WHERE name = ?1").map_err(|e| e.to_string())?;
        for name in deleted {
            delete_stmt.execute(params![name]).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
