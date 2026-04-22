WITH ranked_duplicates AS (
  SELECT
    id,
    external_id,
    project_name,
    COALESCE(raw_data->'fields'->>'System.TeamProject', project_name) AS canonical_project_name,
    ROW_NUMBER() OVER (
      PARTITION BY external_id, COALESCE(raw_data->'fields'->>'System.TeamProject', project_name)
      ORDER BY
        CASE WHEN project_name = COALESCE(raw_data->'fields'->>'System.TeamProject', project_name) THEN 0 ELSE 1 END,
        changed_date DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS duplicate_rank
  FROM public.azure_work_items
), rows_to_delete AS (
  SELECT id
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
     OR project_name IS DISTINCT FROM canonical_project_name
)
DELETE FROM public.azure_work_items awi
USING rows_to_delete rtd
WHERE awi.id = rtd.id;