
-- Create project_file_chunks table for RAG
CREATE TABLE public.project_file_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX project_file_chunks_embedding_idx ON public.project_file_chunks USING hnsw (embedding vector_cosine_ops);

-- Index for filtering by file_id
CREATE INDEX project_file_chunks_file_id_idx ON public.project_file_chunks (file_id);

-- Enable RLS
ALTER TABLE public.project_file_chunks ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view chunks belonging to their project files
CREATE POLICY "Users can view own project file chunks"
ON public.project_file_chunks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_files pf
    JOIN public.projects p ON p.id = pf.project_id
    WHERE pf.id = project_file_chunks.file_id
    AND p.user_id = auth.uid()
  )
);

-- RLS: Users can insert chunks for their own project files
CREATE POLICY "Users can insert own project file chunks"
ON public.project_file_chunks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_files pf
    JOIN public.projects p ON p.id = pf.project_id
    WHERE pf.id = project_file_chunks.file_id
    AND p.user_id = auth.uid()
  )
);

-- RLS: Users can delete chunks for their own project files
CREATE POLICY "Users can delete own project file chunks"
ON public.project_file_chunks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_files pf
    JOIN public.projects p ON p.id = pf.project_id
    WHERE pf.id = project_file_chunks.file_id
    AND p.user_id = auth.uid()
  )
);

-- Add RLS policy for project_files UPDATE (needed for extract-file-text to save extracted_text)
CREATE POLICY "Users can update own project files"
ON public.project_files
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_files.project_id
    AND projects.user_id = auth.uid()
  )
);
