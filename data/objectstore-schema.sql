CREATE TYPE object_type AS ENUM ('resource', 'literal');


CREATE TABLE wb_strings
(
  id_string serial NOT NULL,
  string text NOT NULL,
  CONSTRAINT pk_string PRIMARY KEY (id_string),
  CONSTRAINT u_string UNIQUE (string)
)
WITH (
  OIDS=FALSE
);

CREATE INDEX idx_id_string
  ON wb_strings
  USING btree
  (id_string, string);

CREATE INDEX idx_string_id
  ON wb_strings
  USING btree
  (string, id_string);


CREATE TABLE wb_objects
(
  id_object serial NOT NULL,
  obj_type object_type NOT NULL,
  obj_value INTEGER NOT NULL,
  obj_lang character varying(128) NOT NULL,
  obj_datatype character varying(2048) NOT NULL,
  CONSTRAINT pk_object PRIMARY KEY (id_object),
  CONSTRAINT uidx_obj UNIQUE (obj_type, obj_value, obj_lang, obj_datatype),
  CONSTRAINT fk_obj_value FOREIGN KEY (obj_value)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);

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


CREATE TABLE wb_triples
(
  id_triple serial NOT NULL,
  subject integer NOT NULL,
  predicate integer NOT NULL,
  object integer NOT NULL,
  CONSTRAINT pk_triple PRIMARY KEY (id_triple),
  CONSTRAINT fk_subject FOREIGN KEY (subject)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_predicate FOREIGN KEY (predicate)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_object FOREIGN KEY (object)
      REFERENCES wb_objects (id_object) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT uq_spo UNIQUE (subject, predicate, object)
)
WITH (
  OIDS=FALSE
);


CREATE TABLE wb_users
(
  id_user serial NOT NULL,
  username character varying(128) NOT NULL,
  pw_salted_hash text NOT NULL,
  email character varying(1024) NOT NULL,
  name character varying(1024) NOT NULL,
  CONSTRAINT pk_user PRIMARY KEY (id_user),
  CONSTRAINT u_user UNIQUE (username),
  CONSTRAINT u_email UNIQUE (email)
)
WITH (
  OIDS=FALSE
);

INSERT INTO wb_users (username, pw_salted_hash, email, name) VALUES ('anonymous', 'temporary', 'anonymous@localhost', 'Anonymous User');


CREATE TABLE wb_triple_vers
(
  version integer NOT NULL,
  triple integer NOT NULL,
  triple_order integer NOT NULL,
  change_timestamp time with time zone NOT NULL,
  change_user integer NOT NULL,
  CONSTRAINT pk_version_triple_order PRIMARY KEY (version, triple, triple_order),
  CONSTRAINT fk_triple FOREIGN KEY (triple)
      REFERENCES wb_triples (id_triple) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);

