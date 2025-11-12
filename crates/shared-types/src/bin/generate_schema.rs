//! JSON Schema generator for Resumate types.
//!
//! Single source of truth for schema generation.
//! Generates JSON Schema from Rust types using schemars.
//! Output is used to generate TypeScript types for the Next.js app.

use schemars::schema_for;
use shared_types::ResumeData;
use std::fs;
use std::time::SystemTime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🦀 Generating JSON Schema from shared-types (single source of truth)...\n");

    // Generate schema for ResumeData (root type)
    let schema = schema_for!(ResumeData);

    // Add generation metadata as comment
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)?
        .as_secs();

    let mut schema_value: serde_json::Value = serde_json::to_value(&schema)?;
    schema_value["$comment"] = serde_json::json!(format!(
        "AUTO-GENERATED from crates/shared-types/src/lib.rs at timestamp {}",
        timestamp
    ));

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&schema_value)?;

    // Write to schemas/ directory (canonical location)
    let output_path = "schemas/resume.schema.json";
    fs::create_dir_all("schemas")?;
    fs::write(output_path, json)?;

    println!("✅ Schema written to: {}", output_path);
    println!("\n📝 Next steps:");
    println!("   1. Run: just types-ts");
    println!("   2. Verify: just check-ts");

    Ok(())
}
