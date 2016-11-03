drop table if exists article;
create table article (
       articleid varchar(255) not null primary key,
       siteid varchar(255) not null,
       url varchar(255) not null,
       title varchar(255) not null,
       excerpt varchar(255),
       publishtime timestamp not null,
       contenturl varchar(255) not null,
       imgurl varchar(65535),
       coverimgurl varchar(8092),
       health tinyint(1) default 1 not null, 
       reviewed tinyint(1) default 0 not null,
       hidden tinyint(1) default 0 not null,
       topics varchar(255)
);

