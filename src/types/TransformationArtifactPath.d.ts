/**
 * Transformation-relative path to a file.
 * @example "/foo/bar"
 * @pattern ^/(?:((?!\.*[/\\]).)((?![/\\]\.*[/\\]).)*)?$
 */
export type TransformationArtifactPath = string; // Taken from 'upload-shared/UnboxedPrimitives'
