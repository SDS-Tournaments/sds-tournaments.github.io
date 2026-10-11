-- Удалить тестовых пилотов (и всё, что на них ссылается: регистрации, заезды и т.д. — каскадом)
delete from auth.users where email like 'test-%@test.sds';
