
CREATE ROLE webbox_daniel LOGIN
  ENCRYPTED PASSWORD 'md56d67968901226b8b11bd3d41547a0dcd'
  NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE DATABASE webbox_daniel
  WITH ENCODING='UTF8'
       OWNER=webbox_daniel
       CONNECTION LIMIT=-1;

CREATE EXTENSION pgcrypto;

CREATE TABLE wb_users
(
  id serial NOT NULL,
  username character varying(32) NOT NULL,
  pw_salted_hash text NOT NULL,
  CONSTRAINT pk PRIMARY KEY (id),
  CONSTRAINT u UNIQUE (username)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_users
  OWNER TO webbox_daniel;


-- from: http://www.postgresql.org/docs/9.2/static/pgcrypto.html
-- Example of setting a new password:
-- 
-- UPDATE ... SET pswhash = crypt('new password', gen_salt('md5'));
-- 
-- Example of authentication:
-- SELECT pswhash = crypt('entered password', pswhash) FROM ... ;
-- INSERT INTO wb_users (username, pw_salted_hash) VALUES ('daniel', crypt('foobar', gen_salt('md5')))


CREATE TYPE object_type AS ENUM ('resource', 'literal');

-- Table: wb_objects

-- DROP TABLE wb_objects;

CREATE TABLE wb_objects
(
  id_object serial NOT NULL,
  obj_type object_type NOT NULL,
  obj_value character varying(2048) NOT NULL,
  obj_lang character varying(128),
  obj_datatype character varying(2048),
  CONSTRAINT pk_id_object PRIMARY KEY (id_object),
  CONSTRAINT uidx_obj UNIQUE (obj_type, obj_value, obj_lang, obj_datatype)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_objects
  OWNER TO webbox_daniel;

-- Index: idx_otv

-- DROP INDEX idx_otv;

CREATE INDEX idx_otv
  ON wb_objects
  USING btree
  (id_object, obj_type, obj_value COLLATE pg_catalog."default");

-- Index: idx_vo

-- DROP INDEX idx_vo;

CREATE INDEX idx_vo
  ON wb_objects
  USING btree
  (obj_value COLLATE pg_catalog."default", id_object);



-- Table: wb_data

-- DROP TABLE wb_data;

CREATE TABLE wb_data
(
  id_data serial NOT NULL,
  subject character varying(2048) NOT NULL,
  predicate character varying(2048) NOT NULL,
  object integer NOT NULL,
  object_order integer NOT NULL,
  version integer NOT NULL,
  CONSTRAINT pk_id_data PRIMARY KEY (id_data),
  CONSTRAINT wb_data_object_fkey FOREIGN KEY (object)
      REFERENCES wb_objects (id_object) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_data
  OWNER TO webbox_daniel;

-- Index: idx_po

-- DROP INDEX idx_po;

CREATE INDEX idx_po
  ON wb_data
  USING btree
  (predicate COLLATE pg_catalog."default", object);

-- Index: idx_spo

-- DROP INDEX idx_spo;

CREATE INDEX idx_spo
  ON wb_data
  USING btree
  (subject COLLATE pg_catalog."default", predicate COLLATE pg_catalog."default", object);

-- Index: idx_vpo

-- DROP INDEX idx_vpo;

CREATE INDEX idx_vpo
  ON wb_data
  USING btree
  (version, predicate COLLATE pg_catalog."default", object);

-- Index: idx_vspo

-- DROP INDEX idx_vspo;

CREATE INDEX idx_vspo
  ON wb_data
  USING btree
  (version, subject COLLATE pg_catalog."default", predicate COLLATE pg_catalog."default", object);






-- uri for each version of the object, so people can DELETE each if necessary
-- http://webbox/timemachine/obj/version/1
-- X-WebBox-Predecessor-Set VERSION
-- has to be the current max version to succeed



-- View: wb_v_latest_triples

-- DROP VIEW wb_v_latest_triples;

CREATE OR REPLACE VIEW wb_v_latest_triples AS 
 SELECT wb_data.subject, wb_data.version, wb_data.predicate, 
    wb_data.object_order, wb_objects.obj_type, wb_objects.obj_value, 
    wb_objects.obj_lang, wb_objects.obj_datatype
   FROM wb_data
   JOIN ( SELECT wb_data.subject AS inner_subject, 
            max(wb_data.version) AS inner_version_max
           FROM wb_data
          GROUP BY wb_data.subject) data2 ON wb_data.subject::text = data2.inner_subject::text AND wb_data.version = data2.inner_version_max
   JOIN wb_objects ON wb_data.object = wb_objects.id_object
  ORDER BY wb_data.subject, wb_data.version, wb_data.predicate, wb_data.object_order;

ALTER TABLE wb_v_latest_triples
  OWNER TO webbox_daniel;




-- View: wb_v_triples

-- DROP VIEW wb_v_triples;

CREATE OR REPLACE VIEW wb_v_triples AS 
 SELECT wb_data.subject, wb_data.version, wb_data.predicate, 
    wb_data.object_order, wb_objects.obj_type, wb_objects.obj_value, 
    wb_objects.obj_lang, wb_objects.obj_datatype
   FROM wb_data
   JOIN wb_objects ON wb_data.object = wb_objects.id_object
  ORDER BY wb_data.subject, wb_data.version, wb_data.predicate, wb_data.object_order;

ALTER TABLE wb_v_triples
  OWNER TO webbox_daniel;















