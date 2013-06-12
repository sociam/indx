--    This file is part of WebBox.
--
--    Copyright 2011-2013 Daniel Alexander Smith
--    Copyright 2011-2013 University of Southampton
--
--    WebBox is free software: you can redistribute it and/or modify
--    it under the terms of the GNU General Public License as published by
--    the Free Software Foundation, either version 3 of the License, or
--    (at your option) any later version.
--
--    WebBox is distributed in the hope that it will be useful,
--    but WITHOUT ANY WARRANTY; without even the implied warranty of
--    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
--    GNU General Public License for more details.
--
--    You should have received a copy of the GNU General Public License
--    along with WebBox.  If not, see <http://www.gnu.org/licenses/>.

CREATE OR REPLACE FUNCTION wb_add_triple_to_version(input_version integer, input_subject text, input_predicate text, input_object_value text, input_object_type object_type, input_object_language character varying, input_object_datatype character varying)
  RETURNS boolean AS
$BODY$DECLARE
    triple_result integer;
    max_order integer;
BEGIN
    SELECT * INTO triple_result FROM wb_get_triple_id(input_subject, input_predicate, input_object_value, input_object_type, input_object_language, input_object_datatype);

    SELECT MAX(triple_order) INTO max_order FROM wb_latest_vers;

    IF max_order IS NULL THEN
        max_order := 0;
    END IF;

    INSERT INTO wb_latest_vers (version, triple, triple_order) VALUES (input_version, triple_result, max_order + 1);
    RETURN true;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


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


CREATE OR REPLACE FUNCTION wb_get_string_ids(input_strings text[])
  RETURNS integer[] AS
$BODY$DECLARE
    results_ids integer[];
    i integer;
    input_string text;
    string_id integer;
BEGIN
    results_ids := '{}';
    IF array_length(input_strings,1) > 0 THEN
        FOR i IN 1 .. array_upper(input_strings, 1) LOOP
            input_string := input_strings[i];
            SELECT * INTO string_id FROM wb_get_string_id(input_string);
            results_ids := array_append(results_ids, string_id);
        END LOOP;
    END IF;
    RETURN results_ids;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_clone_version(input_from_version integer, input_to_version integer, input_excludes_subjects text[])
  RETURNS boolean AS
$BODY$DECLARE
    subject_ids integer[];
BEGIN

    SELECT * INTO subject_ids FROM wb_get_string_ids(input_excludes_subjects);

    INSERT INTO wb_triple_vers_snapshots (version, triple, triple_order)
        SELECT    input_to_version as version,
            wb_triples.id_triple as triple,
            wb_latest_vers.triple_order as triple_order
        FROM    wb_latest_vers
        JOIN    wb_triples ON (wb_latest_vers.triple = wb_triples.id_triple)
        WHERE   NOT (wb_triples.subject = ANY(subject_ids));

    RETURN true;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_diff(input_version_from integer, input_version_to integer)
  RETURNS TABLE (subject_id text) AS
$BODY$BEGIN
    RETURN QUERY SELECT DISTINCT subject FROM (

            SELECT 'VerA' as version, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE version = input_version_from
            UNION ALL
            SELECT 'VerB' as version, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE version = input_version_to

        ) AS COMPARISON GROUP BY subject, predicate, obj_value, obj_type, obj_lang, obj_datatype HAVING COUNT(*) = 1;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;



CREATE OR REPLACE FUNCTION wb_diff_changed(input_version_from integer, input_version_to integer)
  RETURNS TABLE (version_out text[], subject_out text, predicate_out text, obj_value_out text, obj_type_out object_type, obj_lang_out character varying(128), obj_datatype_out character varying(2048)) AS
$BODY$BEGIN
    RETURN QUERY SELECT DISTINCT array_agg(ver), subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM (

            SELECT 'from' as ver, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE version = input_version_from
            UNION ALL
            SELECT 'to' as ver, subject, predicate, obj_value, obj_type, obj_lang, obj_datatype FROM wb_v_all_triples WHERE version = input_version_to

        ) AS COMPARISON GROUP BY subject, predicate, obj_value, obj_type, obj_lang, obj_datatype HAVING COUNT(*) = 1;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_version_finished(input_version_to integer)
  RETURNS boolean AS
$BODY$BEGIN
    PERFORM pg_notify('wb_new_version', input_version_to::TEXT);
    RETURN TRUE;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;


CREATE OR REPLACE FUNCTION wb_clone_files_version(input_from_version integer, input_to_version integer, input_excludes_ids text[])
  RETURNS boolean AS
$BODY$BEGIN

    INSERT INTO wb_files (data, version, file_id, contenttype)
        SELECT  wb_files.data as data,
            input_to_version as version,
            wb_files.file_id as file_id,
            wb_files.contenttype as contenttype
        FROM    wb_files
        WHERE        wb_files.version = input_from_version
                AND    NOT (wb_files.file_id = ANY(input_excludes_ids));

    RETURN true;
END;$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
