ALTER TABLE character_libraries ADD COLUMN drama_id INTEGER;
ALTER TABLE scene_libraries ADD COLUMN drama_id INTEGER;
ALTER TABLE prop_libraries ADD COLUMN drama_id INTEGER;

ALTER TABLE character_libraries ADD COLUMN source_id TEXT;
ALTER TABLE scene_libraries ADD COLUMN source_id TEXT;
ALTER TABLE prop_libraries ADD COLUMN source_id TEXT;

UPDATE character_libraries
SET source_id = (
  SELECT CAST(c.id AS TEXT)
  FROM characters c
  WHERE c.deleted_at IS NULL
    AND character_libraries.source_type = 'character'
    AND (character_libraries.drama_id IS NULL OR c.drama_id = character_libraries.drama_id)
    AND (
      (c.local_path IS NOT NULL AND c.local_path <> '' AND (
        c.local_path = character_libraries.local_path
        OR '/static/' || c.local_path = character_libraries.image_url
      ))
      OR (c.image_url IS NOT NULL AND c.image_url <> '' AND c.image_url = character_libraries.image_url)
    )
  ORDER BY c.id ASC
  LIMIT 1
)
WHERE source_id IS NULL
  AND deleted_at IS NULL
  AND source_type = 'character';

UPDATE scene_libraries
SET source_id = (
  SELECT CAST(s.id AS TEXT)
  FROM scenes s
  WHERE s.deleted_at IS NULL
    AND scene_libraries.source_type = 'scene'
    AND (scene_libraries.drama_id IS NULL OR s.drama_id = scene_libraries.drama_id)
    AND (
      (s.local_path IS NOT NULL AND s.local_path <> '' AND (
        s.local_path = scene_libraries.local_path
        OR '/static/' || s.local_path = scene_libraries.image_url
      ))
      OR (s.image_url IS NOT NULL AND s.image_url <> '' AND s.image_url = scene_libraries.image_url)
    )
  ORDER BY s.id ASC
  LIMIT 1
)
WHERE source_id IS NULL
  AND deleted_at IS NULL
  AND source_type = 'scene';

UPDATE prop_libraries
SET source_id = (
  SELECT CAST(p.id AS TEXT)
  FROM props p
  WHERE p.deleted_at IS NULL
    AND prop_libraries.source_type = 'prop'
    AND (prop_libraries.drama_id IS NULL OR p.drama_id = prop_libraries.drama_id)
    AND (
      (p.local_path IS NOT NULL AND p.local_path <> '' AND (
        p.local_path = prop_libraries.local_path
        OR '/static/' || p.local_path = prop_libraries.image_url
      ))
      OR (p.image_url IS NOT NULL AND p.image_url <> '' AND p.image_url = prop_libraries.image_url)
    )
  ORDER BY p.id ASC
  LIMIT 1
)
WHERE source_id IS NULL
  AND deleted_at IS NULL
  AND source_type = 'prop';
