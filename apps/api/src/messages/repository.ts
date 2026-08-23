import { Prisma, prisma } from "@bakbak/db"; //modified

export class MessageRepository {
	//modified
	async create<T extends Prisma.MessageCreateArgs>(
		args: Prisma.SelectSubset<T, Prisma.MessageCreateArgs>,
	) {
		return await prisma.message.create(args);
	}

	async findUnique<T extends Prisma.MessageFindUniqueArgs>(
		args: Prisma.SelectSubset<T, Prisma.MessageFindUniqueArgs>,
	) {
		return await prisma.message.findUnique(args);
	}

	async findFirst<T extends Prisma.MessageFindFirstArgs>(
		args: Prisma.SelectSubset<T, Prisma.MessageFindFirstArgs>,
	) {
		return await prisma.message.findFirst(args);
	}

	async findMany<T extends Prisma.MessageFindManyArgs>(
		args?: Prisma.SelectSubset<T, Prisma.MessageFindManyArgs>,
	) {
		return await prisma.message.findMany(args);
	}

	async update<T extends Prisma.MessageUpdateArgs>(
		args: Prisma.SelectSubset<T, Prisma.MessageUpdateArgs>,
	) {
		return await prisma.message.update(args);
	}

	async count<T extends Prisma.MessageCountArgs>(
		args?: Prisma.SelectSubset<T, Prisma.MessageCountArgs>,
	) {
		return await prisma.message.count(args);
	}

	async updateChat<T extends Prisma.ChatUpdateArgs>(
		args: Prisma.SelectSubset<T, Prisma.ChatUpdateArgs>,
	) {
		return await prisma.chat.update(args);
	}

	async findParticipant<T extends Prisma.ChatParticipantFindFirstArgs>(
		args: Prisma.SelectSubset<T, Prisma.ChatParticipantFindFirstArgs>,
	) {
		return await prisma.chatParticipant.findFirst(args);
	}

	async updateParticipant<T extends Prisma.ChatParticipantUpdateArgs>(
		args: Prisma.SelectSubset<T, Prisma.ChatParticipantUpdateArgs>,
	) {
		return await prisma.chatParticipant.update(args);
	}
}
