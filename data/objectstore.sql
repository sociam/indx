
-- run this script as user webbox (e.g., psql -U webbox)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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


INSERT INTO wb_users (username, pw_salted_hash) VALUES ('anonymous', 'temporary');



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
WITH (
  OIDS=FALSE
);
ALTER TABLE wb_graphver_triples
  OWNER TO webbox;





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
  OWNER TO webbox;




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


-- View: wb_v_latest_triples

-- DROP VIEW wb_v_latest_triples;

CREATE OR REPLACE VIEW wb_v_latest_triples AS 
 SELECT wb_v_latest_graphvers.graph_uri, wb_v_all_triples.graph_version, 
    wb_v_all_triples.triple_order, wb_v_all_triples.subject, 
    wb_v_all_triples.predicate, wb_v_all_triples.obj_value, 
    wb_v_all_triples.obj_type, wb_v_all_triples.obj_lang, 
    wb_v_all_triples.obj_datatype
   FROM wb_v_latest_graphvers
   JOIN wb_v_all_triples ON wb_v_all_triples.graph_uri = wb_v_latest_graphvers.graph_uri AND wb_v_all_triples.graph_version = wb_v_latest_graphvers.latest_version
  ORDER BY wb_v_latest_graphvers.graph_uri, wb_v_all_triples.graph_version, wb_v_all_triples.subject, wb_v_all_triples.triple_order;

ALTER TABLE wb_v_latest_triples
  OWNER TO webbox;


-- Functions


CREATE OR REPLACE FUNCTION wb_add_triple_to_graphvers(input_graphvers_id integer, input_subject text, input_predicate text, input_object_value text, input_object_type object_type, input_object_language character varying, input_object_datatype character varying, input_triple_order integer)
  RETURNS boolean AS
$BODY$DECLARE
    triple_result integer;
BEGIN
    SELECT * INTO triple_result FROM wb_get_triple_id(input_subject, input_predicate, input_object_value, input_object_type, input_object_language, input_object_datatype);

    INSERT INTO wb_graphver_triples (graphver, triple, triple_order) VALUES (input_graphvers_id, triple_result, input_triple_order);
    RETURN true;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION wb_add_triple_to_graphvers(integer, text, text, text, object_type, character varying, character varying, integer)
  OWNER TO webbox;

CREATE OR REPLACE FUNCTION wb_get_graphvers_id(input_graph_version integer, input_graph_uri text, input_user_id integer)
  RETURNS integer AS
$BODY$DECLARE
    graph_uri_value_id integer;
    graphvers_result integer;
    graphvers_new_ver integer;
    graph_prev_ver integer;
BEGIN
    SELECT * INTO graph_uri_value_id FROM wb_get_string_id(input_graph_uri);

    SELECT MAX(wb_graphvers.graph_version) INTO graph_prev_ver FROM wb_graphvers WHERE
        (wb_graphvers.graph_uri = graph_uri_value_id) GROUP BY wb_graphvers.graph_uri;

    IF NOT FOUND THEN
        graph_prev_ver = 0;
    END IF;

    IF input_graph_version != graph_prev_ver THEN
        RETURN NULL;
    END IF;

    graphvers_new_ver = input_graph_version + 1;

    INSERT INTO wb_graphvers (graph_version, graph_uri, change_timestamp, change_user) VALUES (graphvers_new_ver, graph_uri_value_id, CURRENT_TIMESTAMP, input_user_id) RETURNING id_graphver INTO graphvers_result;

    RETURN graphvers_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION wb_get_graphvers_id(integer, text, integer)
  OWNER TO webbox;


CREATE OR REPLACE FUNCTION wb_get_object_id(input_obj_type object_type, input_obj_value text, input_obj_lang character varying, input_obj_datatype character varying)
  RETURNS integer AS
$BODY$DECLARE
    value_id integer;
    object_result integer;
BEGIN
    SELECT * INTO value_id FROM wb_get_string_id(input_obj_value);

    SELECT wb_objects.id_object INTO object_result FROM wb_objects WHERE (wb_objects.obj_type = input_obj_type AND wb_objects.obj_value = value_id AND wb_objects.obj_lang = input_obj_lang AND wb_objects.obj_datatype = input_obj_datatype);
    IF NOT FOUND THEN
        INSERT INTO wb_objects (obj_type, obj_value, obj_lang, obj_datatype) VALUES (input_obj_type, value_id, input_obj_lang, input_obj_datatype) RETURNING wb_objects.id_object INTO object_result;
    END IF;
    RETURN object_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION wb_get_object_id(object_type, text, character varying, character varying)
  OWNER TO webbox;


CREATE OR REPLACE FUNCTION wb_get_string_id(input_string text)
  RETURNS integer AS
$BODY$DECLARE
    string_result integer;
BEGIN
    SELECT wb_strings.id_string INTO string_result FROM wb_strings WHERE (wb_strings.string = input_string);
    IF NOT FOUND THEN
        INSERT INTO wb_strings (string) VALUES (input_string) RETURNING wb_strings.id_string INTO string_result;
    END IF;
    RETURN string_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION wb_get_string_id(text)
  OWNER TO webbox;


CREATE OR REPLACE FUNCTION wb_get_triple_id(input_subject text, input_predicate text, input_object_value text, input_object_type object_type, input_object_language character varying, input_object_datatype character varying)
  RETURNS integer AS
$BODY$DECLARE
    subject_value_id integer;
    predicate_value_id integer;
    object_result integer;
    triple_result integer;
BEGIN
    SELECT * INTO subject_value_id FROM wb_get_string_id(input_subject);
    SELECT * INTO predicate_value_id FROM wb_get_string_id(input_predicate);
    SELECT * INTO object_result FROM wb_get_object_id(input_object_type, input_object_value, input_object_language, input_object_datatype);

    SELECT wb_triples.id_triple INTO triple_result FROM wb_triples WHERE
        (wb_triples.subject = subject_value_id AND
         wb_triples.predicate = predicate_value_id AND
         wb_triples.object = object_result);
    IF NOT FOUND THEN
        INSERT INTO wb_triples (subject, predicate, object) VALUES (subject_value_id, predicate_value_id, object_result) RETURNING wb_triples.id_triple INTO triple_result;
    END IF;
    RETURN triple_result;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION wb_get_triple_id(text, text, text, object_type, character varying, character varying)
  OWNER TO webbox;

























