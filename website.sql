drop table if exists website;
create table website (
       siteid varchar(255) not null primary key,
       sitename varchar(255) not null,
       avatarurl varchar(255) not null,
       hosturl varchar(255) not null,
       description varchar(255),
       siteavatar varchar(255),
       gotosource tinyint(1) not null default 0,
       feed_block_selector varchar(255) not null, 
       article_url_selector varchar(255) not null, 
       article_title_selector varchar(255) not null, 
       article_excerpt_selector varchar(255),
       article_publishtime_selector varchar(255),
       article_publishtime_format varchar(255),
       article_body_selector varchar(255),
       article_body_filter varchar(255),
       article_body_remove_selector varchar(255),
       title_filters varchar(255),
       hidden tinyint(1) default 0 not null,
       date_updated timestamp default CURRENT_TIMESTAMP,
       date_created timestamp default CURRENT_TIMESTAMP
);

insert into website (siteid, sitename, avatarurl, hosturl, feed_block_selector, article_url_selector, article_title_selector, article_excerpt_selector,  article_publishtime_selector, article_publishtime_format, article_body_selector, article_body_filter, article_body_remove_selector) VALUES('mtime', 'Mtime时光网', 'http://rss-cdn.flipchina.cn/mtime/mtime.jpg', 'http://www.mtime.com/community|http://www.mtime.com/review', 'li', 'h3/a$href', 'h3/a',  'p.pcont\\a\\li', 'time', 'YYYY-MM-DD HH:mm', 'div#blogInfoRegion', 'div.andmovie|div.mt9.tr|div.mt9|div.mt10.clearfix|span.editblog|h2|div.mt5', 'div.pagenav.tc');
