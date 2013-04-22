CREATE INDEX idx_id_string
  ON wb_strings
  USING btree
  (id_string, string);

CREATE INDEX idx_string_id
  ON wb_strings
  USING btree
  (string, id_string);


CREATE INDEX idx_otv
  ON wb_objects
  USING btree
  (id_object, obj_type, obj_value);

CREATE INDEX idx_o_all
  ON wb_objects
  USING btree
  (obj_type, obj_value, obj_lang, obj_datatype, id_object);

CREATE INDEX idx_vo
  ON wb_objects
  USING btree
  (obj_value);


CREATE INDEX idx_ver
  ON wb_triple_vers
  USING btree
  (version, triple, triple_order);


CREATE INDEX idx_triple
  ON wb_triples
  USING btree
  (id_triple, subject, predicate, object);

CREATE INDEX idx_predicate
  ON wb_triples
  USING btree
  (predicate, id_triple);

CREATE INDEX idx_subject
  ON wb_triples
  USING btree
  (subject, id_triple);

CREATE INDEX idx_object
  ON wb_triples
  USING btree
  (object, id_triple);


