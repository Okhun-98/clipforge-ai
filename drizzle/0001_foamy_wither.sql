CREATE TABLE `shorts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`description` text,
	`score` float,
	`startTime` float NOT NULL,
	`endTime` float NOT NULL,
	`storageKey` varchar(512),
	`storageUrl` text,
	`status` enum('pending','generating','ready','error') NOT NULL DEFAULT 'pending',
	`captions` json,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shorts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`fullText` text,
	`segments` json,
	`language` varchar(16),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transcripts_id` PRIMARY KEY(`id`),
	CONSTRAINT `transcripts_videoId_unique` UNIQUE(`videoId`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` enum('uploading','transcribing','analyzing','generating','ready','error') NOT NULL DEFAULT 'uploading',
	`storageKey` varchar(512),
	`storageUrl` text,
	`duration` float,
	`fileSize` bigint,
	`mimeType` varchar(64),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
