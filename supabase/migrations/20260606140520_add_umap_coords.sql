-- 2D UMAP projection of each segment's embedding, computed by scripts/compute_umap.py.
-- Nullable: rows inserted before UMAP is run simply have no coordinates yet.
ALTER TABLE eeg_segments
  ADD COLUMN umap_x FLOAT,
  ADD COLUMN umap_y FLOAT;
