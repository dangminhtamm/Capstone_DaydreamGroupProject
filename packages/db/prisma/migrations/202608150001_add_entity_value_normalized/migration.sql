-- Normalize entity values once at write time so retrieval can match names,
-- projects, goals, tags, and habits without case or accent sensitivity.

ALTER TABLE "entity_mentions"
  ADD COLUMN IF NOT EXISTS "entity_value_normalized" TEXT;

-- Backfill structured entities already stored in memory chunk metadata. This
-- does not call an AI provider and makes entity retrieval useful immediately
-- for existing indexed sources.
INSERT INTO "entity_mentions" (
  "id",
  "chunk_id",
  "entity_type",
  "entity_value",
  "entity_value_normalized"
)
SELECT
  gen_random_uuid(),
  memory_chunks."id",
  extracted."entity_type",
  extracted."entity_value",
  lower(translate(
    trim(extracted."entity_value"),
    'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
    'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYDaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  ))
FROM "memory_chunks"
CROSS JOIN LATERAL (
  SELECT 'person'::text AS "entity_type", people.value AS "entity_value"
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(memory_chunks."metadata"->'people') = 'array'
      THEN memory_chunks."metadata"->'people' ELSE '[]'::jsonb END
  ) AS people(value)
  UNION ALL
  SELECT 'project', projects.value
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(memory_chunks."metadata"->'projects') = 'array'
      THEN memory_chunks."metadata"->'projects' ELSE '[]'::jsonb END
  ) AS projects(value)
  UNION ALL
  SELECT 'tag', tags.value
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(memory_chunks."metadata"->'tags') = 'array'
      THEN memory_chunks."metadata"->'tags' ELSE '[]'::jsonb END
  ) AS tags(value)
  UNION ALL
  SELECT 'goal', goals.value
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(memory_chunks."metadata"->'goals') = 'array'
      THEN memory_chunks."metadata"->'goals' ELSE '[]'::jsonb END
  ) AS goals(value)
  UNION ALL
  SELECT 'habit', habits.value
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(memory_chunks."metadata"->'habits') = 'array'
      THEN memory_chunks."metadata"->'habits' ELSE '[]'::jsonb END
  ) AS habits(value)
) AS extracted
WHERE trim(extracted."entity_value") <> ''
ON CONFLICT ("chunk_id", "entity_type", "entity_value") DO NOTHING;

-- Normalize both existing mentions and the metadata backfill without requiring
-- the optional PostgreSQL unaccent extension.
UPDATE "entity_mentions"
SET "entity_value_normalized" = lower(translate(
  trim("entity_value"),
  'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
  'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYDaaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
))
WHERE "entity_value_normalized" IS NULL;

CREATE INDEX IF NOT EXISTS "entity_mentions_type_normalized_value_idx"
  ON "entity_mentions" ("entity_type", "entity_value_normalized");
