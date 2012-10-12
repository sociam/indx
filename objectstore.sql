
CREATE ROLE webbox LOGIN
  ENCRYPTED PASSWORD 'md56d67968901226b8b11bd3d41547a0dcd'
  NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE DATABASE webbox
  WITH ENCODING='UTF8'
       OWNER=webbox
       CONNECTION LIMIT=-1;

CREATE EXTENSION pgcrypto;

-- from: http://www.postgresql.org/docs/9.2/static/pgcrypto.html
-- Example of setting a new password:
-- 
-- UPDATE ... SET pswhash = crypt('new password', gen_salt('md5'));
-- 
-- Example of authentication:
-- SELECT pswhash = crypt('entered password', pswhash) FROM ... ;
-- INSERT INTO wb_users (username, pw_salted_hash) VALUES ('daniel', crypt('foobar', gen_salt('md5')))


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
ALTER TABLE wb_strings
  OWNER TO webbox;

CREATE INDEX idx_id_string
  ON wb_strings
  USING btree
  (id_string, string);



CREATE TABLE wb_objects
(
  id_object serial NOT NULL,
  obj_type object_type NOT NULL,
  obj_value INTEGER NOT NULL,
  obj_lang character varying(128),
  obj_datatype character varying(2048),
  CONSTRAINT pk_object PRIMARY KEY (id_object),
  CONSTRAINT uidx_obj UNIQUE (obj_type, obj_value, obj_lang, obj_datatype),
  CONSTRAINT fk_obj_value FOREIGN KEY (obj_value)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_objects
  OWNER TO webbox;

-- Index: idx_otv

-- DROP INDEX idx_otv;

CREATE INDEX idx_otv
  ON wb_objects
  USING btree
  (id_object, obj_type, obj_value);

-- Index: idx_vo

-- DROP INDEX idx_vo;

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
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_triples
  OWNER TO webbox;




CREATE TABLE wb_users
(
  id_user serial NOT NULL,
  username character varying(128) NOT NULL,
  pw_salted_hash text NOT NULL,
  CONSTRAINT pk_user PRIMARY KEY (id_user),
  CONSTRAINT u UNIQUE (username)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_users
  OWNER TO webbox;





CREATE TABLE wb_graphvers
(
  id_graphver serial NOT NULL,
  graph_version integer NOT NULL,
  graph_uri integer NOT NULL,
  change_timestamp time with time zone NOT NULL,
  change_user integer NOT NULL,
  CONSTRAINT pk_graphver PRIMARY KEY (id_graphver),
  CONSTRAINT fk_changeuser FOREIGN KEY (change_user)
      REFERENCES wb_users (id_user) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_graph_uri FOREIGN KEY (graph_uri)
      REFERENCES wb_strings (id_string) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_graphvers
  OWNER TO webbox;







CREATE TABLE wb_graphver_triples
(
  graphver integer NOT NULL,
  triple integer NOT NULL,
  triple_order integer NOT NULL,
  CONSTRAINT pk_graphver_triple_order PRIMARY KEY (graphver, triple, triple_order),
  CONSTRAINT fk_graphver FOREIGN KEY (graphver)
      REFERENCES wb_graphvers (id_graphver) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT fk_triple FOREIGN KEY (triple)
      REFERENCES wb_triples (id_triple) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION

)





-- uri for each version of the object, so people can DELETE each if necessary
-- http://webbox/timemachine/obj/version/1
-- X-WebBox-Predecessor-Set VERSION
-- has to be the current max version to succeed


-- View: wb_v_all_triples

-- DROP VIEW wb_v_all_triples;

CREATE OR REPLACE VIEW wb_v_all_triples AS 
 SELECT j_graphuri.string AS graph_uri, wb_graphvers.graph_version, 
    wb_graphver_triples.triple_order, j_subject.string AS subject, 
    j_predicate.string AS predicate, j_object.string AS obj_value, 
    wb_objects.obj_type, wb_objects.obj_lang, wb_objects.obj_datatype
   FROM wb_graphvers
   JOIN wb_strings j_graphuri ON j_graphuri.id_string = wb_graphvers.graph_uri
   JOIN wb_graphver_triples ON wb_graphvers.id_graphver = wb_graphver_triples.graphver
   JOIN wb_triples ON wb_triples.id_triple = wb_graphver_triples.triple
   JOIN wb_objects ON wb_objects.id_object = wb_triples.object
   JOIN wb_strings j_subject ON j_subject.id_string = wb_triples.subject
   JOIN wb_strings j_predicate ON j_predicate.id_string = wb_triples.predicate
   JOIN wb_strings j_object ON j_object.id_string = wb_objects.obj_value
  ORDER BY wb_graphvers.graph_uri, wb_graphvers.graph_version, j_subject.string, wb_graphver_triples.triple_order;

ALTER TABLE wb_v_all_triples
  OWNER TO postgres;




-- View: wb_v_latest_graphvers

-- DROP VIEW wb_v_latest_graphvers;

CREATE OR REPLACE VIEW wb_v_latest_graphvers AS 
 SELECT max(wb_graphvers.graph_version) AS latest_version, 
    wb_strings.string AS graph_uri
   FROM wb_graphvers
   JOIN wb_strings ON wb_strings.id_string = wb_graphvers.graph_uri
  GROUP BY wb_strings.string;

ALTER TABLE wb_v_latest_graphvers
  OWNER TO webbox;



