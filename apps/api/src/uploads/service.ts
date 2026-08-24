export class UploadService {
	// TODO: wire an online storage provider (S3 / Cloudflare R2 / Cloudinary).
	//
	// Suggested flow once implemented:
	//  1. upload()   -> validate mime/size, stream to provider under a
	//                   user-scoped key (e.g. `${userId}/${uuid}.${ext}`)
	//  2. persist    -> create an Attachment row (see packages/db
	//                   prisma/schema/message/file.prisma) with the provider URL
	//  3. read       -> hand out signed GET urls (or a CDN base) so private
	//                   files are not publicly addressable
	//  4. delete     -> remove provider object + mark/delete the DB row
}
