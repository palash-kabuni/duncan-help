
CREATE OR REPLACE FUNCTION public.match_project_chunks(
  query_embedding vector(1536),
  file_ids uuid[],
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  chunk_index integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    pfc.id,
    pfc.file_id,
    pfc.chunk_index,
    pfc.content,
    1 - (pfc.embedding <=> query_embedding) AS similarity
  FROM public.project_file_chunks pfc
  WHERE pfc.file_id = ANY(file_ids)
    AND pfc.embedding IS NOT NULL
  ORDER BY pfc.embedding <=> query_embedding
  LIMIT match_count;
$$;
