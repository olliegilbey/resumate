#!/usr/bin/env python3
"""
Structural diff of resume compendium JSON files.

Compares old (current) vs new (candidate) resume data and reports
all additions, removals, modifications, and reorderings across every
section of the compendium.

Usage:
    python3 scripts/diff-compendium.py <old.json> <new.json>

Exit codes:
    0 — files are identical
    1 — differences found (diff printed to stdout)
    2 — error (missing file, invalid JSON, etc.)
"""

import json
import sys
from pathlib import Path


def build_id_map(items: list, source: str, kind: str) -> dict:
    """Build an {id: item} map, warning on duplicate IDs so they aren't silently dropped."""
    seen: dict = {}
    duplicates: dict[str, int] = {}
    for item in items:
        iid = item["id"]
        if iid in seen:
            duplicates[iid] = duplicates.get(iid, 1) + 1
        seen[iid] = item
    if duplicates:
        for iid, count in sorted(duplicates.items()):
            print(
                f"WARNING: duplicate {kind} id '{iid}' in {source} ({count} occurrences, only last kept)",
                file=sys.stderr,
            )
    return seen


def load_json(path: str) -> dict:
    """Load and parse a JSON file, exiting on failure."""
    p = Path(path)
    if not p.exists():
        print(f"ERROR: File not found: {path}", file=sys.stderr)
        sys.exit(2)
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {path}: {e}", file=sys.stderr)
        sys.exit(2)


def diff_sets(old: set, new: set, label: str) -> list[str]:
    """Return human-readable lines for added/removed items in a set."""
    lines = []
    added = sorted(new - old)
    removed = sorted(old - new)
    if added:
        lines.append(f"  Added: {added}")
    if removed:
        lines.append(f"  Removed: {removed}")
    return lines


def diff_scalar(key: str, old_val, new_val) -> list[str]:
    """Diff a single scalar field."""
    if old_val == new_val:
        return []
    old_display = repr(old_val)[:120]
    new_display = repr(new_val)[:120]
    return [f"  {key}: {old_display} -> {new_display}"]


def diff_list_of_strings(key: str, old_list: list, new_list: list) -> list[str]:
    """Diff an ordered list of strings, showing adds, removes, and reorders."""
    lines = []
    old_set, new_set = set(old_list), set(new_list)
    added = sorted(new_set - old_set)
    removed = sorted(old_set - new_set)
    if added:
        lines.append(f"  {key} added: {added}")
    if removed:
        lines.append(f"  {key} removed: {removed}")
    # Check reordering of shared items
    shared = [x for x in old_list if x in new_set]
    shared_new = [x for x in new_list if x in old_set]
    if shared != shared_new and not added and not removed:
        lines.append(f"  {key} reordered")
    return lines


def diff_personal(old: dict, new: dict) -> list[str]:
    """Diff the personal info section."""
    lines = []
    all_keys = set(old.keys()) | set(new.keys())
    for k in sorted(all_keys):
        lines.extend(diff_scalar(k, old.get(k), new.get(k)))
    return lines


def diff_skills(old: dict, new: dict) -> list[str]:
    """Diff the skills section (technical, soft, etc.)."""
    lines = []
    all_keys = set(old.keys()) | set(new.keys())
    for cat in sorted(all_keys):
        old_skills = old.get(cat, [])
        new_skills = new.get(cat, [])
        cat_lines = diff_list_of_strings(cat, old_skills, new_skills)
        if cat_lines:
            lines.extend(cat_lines)
    return lines


def diff_education(old_list: list, new_list: list) -> list[str]:
    """Diff education entries by index."""
    lines = []
    max_len = max(len(old_list), len(new_list))
    for i in range(max_len):
        old_ed = old_list[i] if i < len(old_list) else {}
        new_ed = new_list[i] if i < len(new_list) else {}
        label = new_ed.get("degree", old_ed.get("degree", f"[index {i}]"))
        entry_lines = []
        all_keys = set(old_ed.keys()) | set(new_ed.keys())
        for k in sorted(all_keys):
            ov, nv = old_ed.get(k), new_ed.get(k)
            if ov == nv:
                continue
            if isinstance(ov, list) and isinstance(nv, list):
                entry_lines.extend(diff_list_of_strings(k, ov, nv))
            else:
                entry_lines.extend(diff_scalar(k, ov, nv))
        if entry_lines:
            lines.append(f"  [{label}]")
            lines.extend(f"  {l}" for l in entry_lines)
    return lines


def diff_accomplishments(old_list: list, new_list: list) -> list[str]:
    """Diff accomplishments by ID."""
    lines = []
    old_map = build_id_map(old_list, "old.accomplishments", "accomplishment")
    new_map = build_id_map(new_list, "new.accomplishments", "accomplishment")

    added_ids = set(new_map) - set(old_map)
    removed_ids = set(old_map) - set(new_map)

    for aid in sorted(added_ids):
        a = new_map[aid]
        lines.append(f"  + NEW {aid}: {a.get('title', '?')} ({a.get('year', '?')})")

    for aid in sorted(removed_ids):
        a = old_map[aid]
        lines.append(f"  - REMOVED {aid}: {a.get('title', '?')} ({a.get('year', '?')})")

    for aid in sorted(set(old_map) & set(new_map)):
        oa, na = old_map[aid], new_map[aid]
        entry_lines = []
        for k in sorted(set(oa.keys()) | set(na.keys())):
            ov, nv = oa.get(k), na.get(k)
            if ov == nv:
                continue
            if isinstance(ov, list) and isinstance(nv, list):
                entry_lines.extend(diff_list_of_strings(k, ov, nv))
            else:
                entry_lines.extend(diff_scalar(k, ov, nv))
        if entry_lines:
            lines.append(f"  ~ MODIFIED {aid}: {na.get('title', '?')}")
            lines.extend(f"    {l.strip()}" for l in entry_lines)

    # Check reordering
    old_order = [a["id"] for a in old_list]
    new_order = [a["id"] for a in new_list]
    shared_old = [x for x in old_order if x in set(new_map)]
    shared_new = [x for x in new_order if x in set(old_map)]
    if shared_old != shared_new:
        lines.append("  Reordered (shared items appear in different order)")

    return lines


def diff_role_profiles(old_list: list, new_list: list) -> list[str]:
    """Diff role profiles by ID."""
    lines = []
    old_map = build_id_map(old_list, "old.roleProfiles", "role profile")
    new_map = build_id_map(new_list, "new.roleProfiles", "role profile")

    for rid in sorted(set(new_map) - set(old_map)):
        r = new_map[rid]
        lines.append(f"  + NEW {rid}: {r.get('name', '?')}")
        lines.append(f"    description: {r.get('description', '')[:100]}")
        tw = r.get("tagWeights", {})
        lines.append(f"    tagWeights ({len(tw)}): {list(tw.keys())}")

    for rid in sorted(set(old_map) - set(new_map)):
        r = old_map[rid]
        lines.append(f"  - REMOVED {rid}: {r.get('name', '?')}")

    for rid in sorted(set(old_map) & set(new_map)):
        or_, nr = old_map[rid], new_map[rid]
        entry_lines = []
        for k in ["name", "description"]:
            entry_lines.extend(diff_scalar(k, or_.get(k), nr.get(k)))
        # tagWeights diff
        otw = or_.get("tagWeights", {})
        ntw = nr.get("tagWeights", {})
        tw_added = sorted(set(ntw) - set(otw))
        tw_removed = sorted(set(otw) - set(ntw))
        tw_changed = [
            t for t in sorted(set(otw) & set(ntw)) if otw[t] != ntw[t]
        ]
        if tw_added:
            entry_lines.append(f"  tagWeights added: {tw_added}")
        if tw_removed:
            entry_lines.append(f"  tagWeights removed: {tw_removed}")
        if tw_changed:
            for t in tw_changed:
                entry_lines.append(f"  tagWeight {t}: {otw[t]} -> {ntw[t]}")
        # scoringWeights diff
        osw = or_.get("scoringWeights", {})
        nsw = nr.get("scoringWeights", {})
        for sk in sorted(set(osw.keys()) | set(nsw.keys())):
            entry_lines.extend(
                diff_scalar(f"scoringWeight.{sk}", osw.get(sk), nsw.get(sk))
            )
        if entry_lines:
            lines.append(f"  ~ MODIFIED {rid}: {nr.get('name', '?')}")
            lines.extend(f"    {l.strip()}" for l in entry_lines)

    return lines


def diff_bullets(old_bullets: list, new_bullets: list, indent: str = "") -> list[str]:
    """Diff bullet children by ID."""
    lines = []
    old_map = build_id_map(old_bullets, "old.bullets", "bullet")
    new_map = build_id_map(new_bullets, "new.bullets", "bullet")

    for bid in sorted(set(new_map) - set(old_map)):
        b = new_map[bid]
        desc = b.get("description", "")[:100]
        lines.append(f"{indent}+ NEW {bid}: {desc}")

    for bid in sorted(set(old_map) - set(new_map)):
        b = old_map[bid]
        desc = b.get("description", "")[:100]
        lines.append(f"{indent}- REMOVED {bid}: {desc}")

    for bid in sorted(set(old_map) & set(new_map)):
        ob, nb = old_map[bid], new_map[bid]
        if ob == nb:
            continue
        changes = []
        for k in sorted(set(ob.keys()) | set(nb.keys())):
            if ob.get(k) == nb.get(k):
                continue
            if k == "description":
                changes.append(f"description changed")
                changes.append(f"  old: {ob.get(k, '')[:100]}")
                changes.append(f"  new: {nb.get(k, '')[:100]}")
            elif isinstance(ob.get(k), list) and isinstance(nb.get(k), list):
                for l in diff_list_of_strings(k, ob.get(k, []), nb.get(k, [])):
                    changes.append(l.strip())
            else:
                for l in diff_scalar(k, ob.get(k), nb.get(k)):
                    changes.append(l.strip())
        if changes:
            lines.append(f"{indent}~ MODIFIED {bid}:")
            lines.extend(f"{indent}  {c}" for c in changes)

    return lines


def diff_experience(old_list: list, new_list: list) -> list[str]:
    """Diff experience (companies -> positions -> bullets) by ID."""
    lines = []
    old_map = build_id_map(old_list, "old.experience", "experience")
    new_map = build_id_map(new_list, "new.experience", "experience")

    # New experiences
    for eid in sorted(set(new_map) - set(old_map)):
        e = new_map[eid]
        lines.append(f"  + NEW EXPERIENCE: {e.get('name', '?')} ({eid})")
        lines.append(f"    {e.get('dateStart', '?')} - {e.get('dateEnd', 'present')}")
        lines.append(f"    {e.get('description', '')[:120]}")
        for pos in e.get("children", []):
            bullets = pos.get("children", [])
            lines.append(
                f"    Position: {pos.get('name', '?')} ({pos['id']}) — {len(bullets)} bullets"
            )
            for b in bullets:
                lines.append(f"      - {b['id']}: {b.get('description', '')[:90]}")

    # Removed experiences
    for eid in sorted(set(old_map) - set(new_map)):
        e = old_map[eid]
        lines.append(f"  - REMOVED EXPERIENCE: {e.get('name', '?')} ({eid})")

    # Modified experiences
    for eid in sorted(set(old_map) & set(new_map)):
        oe, ne = old_map[eid], new_map[eid]
        exp_lines = []

        # Top-level fields
        for k in ["name", "description", "dateStart", "dateEnd", "priority", "location"]:
            exp_lines.extend(diff_scalar(k, oe.get(k), ne.get(k)))
        if oe.get("tags") != ne.get("tags"):
            exp_lines.extend(
                diff_list_of_strings("tags", oe.get("tags", []), ne.get("tags", []))
            )

        # Positions
        old_pos = build_id_map(oe.get("children", []), f"old.experience[{eid}].positions", "position")
        new_pos = build_id_map(ne.get("children", []), f"new.experience[{eid}].positions", "position")

        for pid in sorted(set(new_pos) - set(old_pos)):
            p = new_pos[pid]
            bullets = p.get("children", [])
            exp_lines.append(f"  + NEW Position: {p.get('name', '?')} ({pid}) — {len(bullets)} bullets")
            for b in bullets:
                exp_lines.append(f"      - {b['id']}: {b.get('description', '')[:90]}")

        for pid in sorted(set(old_pos) - set(new_pos)):
            p = old_pos[pid]
            exp_lines.append(f"  - REMOVED Position: {p.get('name', '?')} ({pid})")

        for pid in sorted(set(old_pos) & set(new_pos)):
            op, np_ = old_pos[pid], new_pos[pid]
            pos_lines = []
            for k in ["name", "description", "dateStart", "dateEnd", "priority"]:
                pos_lines.extend(diff_scalar(k, op.get(k), np_.get(k)))
            if op.get("tags") != np_.get("tags"):
                pos_lines.extend(
                    diff_list_of_strings("tags", op.get("tags", []), np_.get("tags", []))
                )
            # Bullets
            bullet_lines = diff_bullets(
                op.get("children", []), np_.get("children", []), indent="      "
            )
            if pos_lines or bullet_lines:
                exp_lines.append(f"  Position: {np_.get('name', '?')} ({pid})")
                exp_lines.extend(f"    {l.strip()}" for l in pos_lines)
                exp_lines.extend(bullet_lines)

        if exp_lines:
            lines.append(f"  ~ {ne.get('name', '?')} ({eid})")
            lines.extend(f"    {l.strip() if not l.startswith('      ') else l}" for l in exp_lines)

    return lines


def count_bullets(data: dict) -> int:
    """Count total bullets across all experience."""
    total = 0
    for e in data.get("experience", []):
        for p in e.get("children", []):
            total += len(p.get("children", []))
    return total


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/diff-compendium.py <old.json> <new.json>")
        sys.exit(2)

    old = load_json(sys.argv[1])
    new = load_json(sys.argv[2])

    sections = []
    has_diff = False

    # Personal
    personal_lines = diff_personal(old.get("personal", {}), new.get("personal", {}))
    if personal_lines:
        sections.append(("PERSONAL", personal_lines))

    # Summary
    summary_lines = diff_scalar("summary", old.get("summary"), new.get("summary"))
    if summary_lines:
        sections.append(("SUMMARY", summary_lines))

    # Tagline
    tagline_lines = diff_scalar("tagline", old.get("tagline"), new.get("tagline"))
    if tagline_lines:
        sections.append(("TAGLINE", tagline_lines))

    # Skills
    skills_lines = diff_skills(old.get("skills", {}), new.get("skills", {}))
    if skills_lines:
        sections.append(("SKILLS", skills_lines))

    # Education
    edu_lines = diff_education(old.get("education", []), new.get("education", []))
    if edu_lines:
        sections.append(("EDUCATION", edu_lines))

    # Accomplishments
    acc_lines = diff_accomplishments(
        old.get("accomplishments", []), new.get("accomplishments", [])
    )
    if acc_lines:
        sections.append(("ACCOMPLISHMENTS", acc_lines))

    # Interests
    int_lines = diff_list_of_strings(
        "interests", old.get("interests", []), new.get("interests", [])
    )
    if int_lines:
        sections.append(("INTERESTS", int_lines))

    # Role Profiles
    rp_lines = diff_role_profiles(
        old.get("roleProfiles", []), new.get("roleProfiles", [])
    )
    if rp_lines:
        sections.append(("ROLE PROFILES", rp_lines))

    # Experience
    exp_lines = diff_experience(old.get("experience", []), new.get("experience", []))
    if exp_lines:
        sections.append(("EXPERIENCE", exp_lines))

    # Stats
    old_bullets = count_bullets(old)
    new_bullets = count_bullets(new)
    old_acc = len(old.get("accomplishments", []))
    new_acc = len(new.get("accomplishments", []))
    old_rp = len(old.get("roleProfiles", []))
    new_rp = len(new.get("roleProfiles", []))
    old_exp = len(old.get("experience", []))
    new_exp = len(new.get("experience", []))

    stats = []
    stats.append(f"  Experience entries: {old_exp} -> {new_exp}")
    stats.append(f"  Total bullets: {old_bullets} -> {new_bullets}")
    stats.append(f"  Accomplishments: {old_acc} -> {new_acc}")
    stats.append(f"  Role profiles: {old_rp} -> {new_rp}")

    # Output
    if not sections:
        print("No differences found.")
        sys.exit(0)

    print("=" * 60)
    print("COMPENDIUM DIFF REPORT")
    print("=" * 60)

    print("\n--- STATS ---")
    for s in stats:
        print(s)

    for title, lines in sections:
        print(f"\n--- {title} ---")
        for line in lines:
            print(line)

    print("\n" + "=" * 60)
    sys.exit(1)


if __name__ == "__main__":
    main()
